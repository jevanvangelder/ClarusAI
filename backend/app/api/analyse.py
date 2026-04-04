from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.services.ai_service import ai_service
from app.core.config import settings
from supabase import create_client, Client
import os
import json
import traceback

router = APIRouter(prefix="/api/analyse", tags=["analyse"])

# ✅ Gebruik service_key met fallback op anon key (net als opdrachten.py)
_service_key = os.getenv("SUPABASE_SERVICE_KEY") or settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY
supabase: Client = create_client(settings.SUPABASE_URL, _service_key)


class KerninzichtBody(BaseModel):
    assignment_id: str
    class_id: Optional[str] = None


class StudentNamenBody(BaseModel):
    student_ids: List[str]


@router.post("/student-namen")
async def get_student_namen(body: StudentNamenBody):
    """
    Haalt voornaam + achternaam op voor een lijst student-IDs.
    Gebruikt de service key om RLS te omzeilen.
    """
    try:
        if not body.student_ids:
            return {}

        profielen_res = supabase.table("profiles").select(
            "id, full_name, first_name, last_name"
        ).in_("id", body.student_ids).execute()

        result = {}
        for p in (profielen_res.data or []):
            # Gebruik full_name als gevuld, anders first_name + last_name samenvoegen
            if p.get("full_name") and p["full_name"].strip():
                result[p["id"]] = p["full_name"].strip()
            elif p.get("first_name") or p.get("last_name"):
                result[p["id"]] = f"{p.get('first_name') or ''} {p.get('last_name') or ''}".strip()

        return result

    except Exception as e:
        print(f"❌ STUDENT-NAMEN error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/kerninzicht")
async def genereer_kerninzicht(body: KerninzichtBody):
    try:
        # Haal de opdracht op
        opdracht_res = supabase.table("assignments").select(
            "id, title, beschrijving, type, max_punten, vragen"
        ).eq("id", body.assignment_id).single().execute()

        if not opdracht_res.data:
            raise HTTPException(status_code=404, detail="Opdracht niet gevonden")

        opdracht = opdracht_res.data
        vragen = opdracht.get("vragen", [])
        if isinstance(vragen, str):
            vragen = json.loads(vragen)

        # Haal inzendingen op (gefilterd op klas indien opgegeven)
        submissions_query = supabase.table("assignment_submissions").select(
            "id, student_id, totaal_punten, antwoorden, ingeleverd_op"
        ).eq("assignment_id", body.assignment_id).eq("ai_nakijk_status", "done")

        if body.class_id:
            submissions_query = submissions_query.eq("class_id", body.class_id)

        submissions_res = submissions_query.execute()
        submissions = submissions_res.data or []

        if len(submissions) == 0:
            return {
                "kerninzicht": "Er zijn nog geen ingeleverde en nagekeken opdrachten beschikbaar voor analyse.",
                "vervolgvoorstel": "",
                "chat_prompt": "",
                "aantal_ingeleverd": 0,
            }

        # Haal studentnamen op (via service key, omzeilt RLS)
        student_ids = list({s["student_id"] for s in submissions})
        profielen_res = supabase.table("profiles").select(
            "id, full_name, first_name, last_name"
        ).in_("id", student_ids).execute()

        profielen = {}
        for p in (profielen_res.data or []):
            if p.get("full_name") and p["full_name"].strip():
                profielen[p["id"]] = p["full_name"].strip()
            elif p.get("first_name") or p.get("last_name"):
                profielen[p["id"]] = f"{p.get('first_name') or ''} {p.get('last_name') or ''}".strip()
            else:
                profielen[p["id"]] = "Leerling"

        # Haal klasnaam op
        klasnaam = "de klas"
        if body.class_id:
            klas_res = supabase.table("classes").select("name").eq("id", body.class_id).single().execute()
            if klas_res.data:
                klasnaam = klas_res.data.get("name", "de klas")

        # Bouw analyse context
        max_punten = opdracht.get("max_punten", 1)
        scores = [s.get("totaal_punten", 0) for s in submissions]
        gemiddelde = round(sum(scores) / len(scores), 1) if scores else 0

        # Per-vraag analyse
        vraag_scores: dict = {}
        for s in submissions:
            for ant in (s.get("antwoorden") or []):
                vn = ant.get("vraag_nummer")
                nakijk = ant.get("nakijk")
                if vn and nakijk:
                    if vn not in vraag_scores:
                        vraag_scores[vn] = {"behaald": 0, "max": 0, "count": 0}
                    vraag_scores[vn]["behaald"] += nakijk.get("punten_behaald", 0)
                    vraag_scores[vn]["max"] += ant.get("max_punten", 0)
                    vraag_scores[vn]["count"] += 1

        vraag_samenvatting = []
        for v in vragen:
            vn = v.get("nummer")
            qs = vraag_scores.get(vn)
            if qs and qs["max"] > 0:
                pct = round((qs["behaald"] / qs["max"]) * 100)
                vraag_samenvatting.append(
                    f"Vraag {vn} ({v.get('vraag', '')[:60]}): {pct}% correct ({qs['behaald']}/{qs['max']} punten)"
                )

        # Alle open antwoorden voor diepere analyse
        open_antwoorden_tekst = ""
        for s in submissions[:15]:  # max 15 leerlingen voor prompt-grootte
            naam = profielen.get(s["student_id"], "Leerling")
            for ant in (s.get("antwoorden") or []):
                v = next((q for q in vragen if q.get("nummer") == ant.get("vraag_nummer")), None)
                if v and v.get("type") == "open" and ant.get("student_antwoord"):
                    open_antwoorden_tekst += (
                        f"- {naam} op vraag {ant['vraag_nummer']}: \"{ant['student_antwoord'][:150]}\"\n"
                    )

        analyse_prompt = f"""Je bent een onderwijsexpert die een docent helpt inzicht te krijgen in de prestaties van hun klas.

OPDRACHT: {opdracht['title']}
TYPE: {opdracht['type']}
KLAS: {klasnaam}

STATISTIEKEN:
- Aantal ingeleverd: {len(submissions)}
- Gemiddelde score: {gemiddelde}/{max_punten} punten
- Gemiddeld cijfer: {round(1 + (gemiddelde / max_punten) * 9, 1) if max_punten > 0 else 'N/A'}

SCORES PER VRAAG:
{chr(10).join(vraag_samenvatting) if vraag_samenvatting else 'Geen vraagdata beschikbaar'}

VOORBEELDEN VAN OPEN ANTWOORDEN:
{open_antwoorden_tekst[:2000] if open_antwoorden_tekst else 'Geen open antwoorden'}

TAAK:
Geef een KERNINZICHT in 3-5 zinnen:
1. Wat gaat goed in de klas?
2. Waar heeft de klas duidelijk moeite mee? (specifiek, niet algemeen)
3. Welke leervaardigheden of kennisgebieden zijn zwak (bijv. "verbanden leggen", "oorzaak-gevolg redeneren", "begrippen toepassen")?

Wees concreet en gebruik de naam van de klas ({klasnaam}). Schrijf in gewone lerarentaal, geen jargon.
Geef ALLEEN het kerninzicht, geen aanhef of afsluiting."""

        kerninzicht = await ai_service.generate_response(
            messages=[{"role": "user", "content": analyse_prompt}],
            role="teacher",
            module_prompts=[],
        )

        # Vervolgvoorstel genereren
        voorstel_prompt = f"""Je bent een onderwijsexpert.

KERNINZICHT OVER KLAS {klasnaam}:
{kerninzicht}

OPDRACHT: {opdracht['title']} ({opdracht['type']})

TAAK: Geef een concreet VERVOLGVOORSTEL in 2-3 zinnen:
- Wat kan de docent CONCREET doen om de klas verder te helpen op het zwakke punt?
- Denk aan: extra oefening, andere werkvorm, lesonderdeel, opdracht of instructie
- Sluit direct aan op het kerninzicht

Geef daarna op een nieuwe regel het label CHATPROMPT: gevolgd door een uitgewerkte prompt die de docent direct in de AI-chatbot kan gebruiken om aan de slag te gaan met jouw voorstel.
De chatprompt moet beginnen met de context (klas, opdracht, probleem) en eindigen met een concrete vraag aan de AI.
Schrijf de chatprompt alsof de docent hem zelf verstuurt."""

        voorstel_raw = await ai_service.generate_response(
            messages=[{"role": "user", "content": voorstel_prompt}],
            role="teacher",
            module_prompts=[],
        )

        # Splits vervolgvoorstel en chatprompt
        chat_prompt = ""
        vervolgvoorstel = voorstel_raw
        if "CHATPROMPT:" in voorstel_raw:
            parts = voorstel_raw.split("CHATPROMPT:", 1)
            vervolgvoorstel = parts[0].strip()
            chat_prompt = parts[1].strip()

        return {
            "kerninzicht": kerninzicht.strip(),
            "vervolgvoorstel": vervolgvoorstel.strip(),
            "chat_prompt": chat_prompt.strip(),
            "aantal_ingeleverd": len(submissions),
            "gemiddelde_score": gemiddelde,
            "max_punten": max_punten,
            "vraag_scores": vraag_samenvatting,
            "klasnaam": klasnaam,
        }

    except Exception as e:
        print(f"❌ KERNINZICHT error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))