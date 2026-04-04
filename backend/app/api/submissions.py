from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.config import settings
from app.services.ai_service import ai_service
from supabase import create_client, Client
import json
import traceback
import re
from datetime import datetime

router = APIRouter(prefix="/api/submissions", tags=["submissions"])
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


# ============ MODELS ============

class TutorChatBody(BaseModel):
    content: str
    messages: Optional[List[dict]] = []
    opdracht_context: str

class NakijkBody(BaseModel):
    submission_id: str
    antwoorden: List[dict]

class SaveDraftBody(BaseModel):
    assignment_id: str
    student_id: str
    class_id: str
    antwoorden: list
    chat_log: list

class InleverBody(BaseModel):
    assignment_id: str
    student_id: str
    class_id: str
    antwoorden: list
    chat_log: list
    max_punten: int


# ============ HELPERS ============

BLOKKEER_ANTWOORD = (
    "🚫 Dat lijkt op een vraag uit je opdracht! Dat antwoord moet van jou komen. "
    "Heb je het al in je schoolboek opgezocht? Wat weet je er zelf al van?"
)

def extract_kernwoorden(vragen: list) -> list[str]:
    """
    Haalt alle betekenisvolle woorden uit de vraagteksten.
    Dit zijn de woorden waar de AI niets over mag uitleggen.
    Stopwoorden worden gefilterd zodat alleen vakinhoudelijke termen overblijven.
    """
    stopwoorden = {
        "de", "het", "een", "is", "wat", "welke", "van", "in", "op", "aan",
        "voor", "met", "zijn", "heeft", "worden", "wordt", "of", "en", "dat",
        "die", "dit", "er", "als", "naar", "niet", "ook", "bij", "door",
        "over", "uit", "te", "ze", "je", "we", "hij", "zij", "ik", "u",
        "hoe", "waarom", "wanneer", "wie", "welk", "stel", "stelling",
        "volgende", "leg", "uit", "geef", "noem", "beschrijf", "verklaar",
        "waar", "onwaar", "true", "false", "juist", "onjuist",
    }

    kernwoorden = set()
    for v in vragen:
        tekst = v.get("vraag", "").lower()
        # Verwijder leestekens
        tekst = re.sub(r"[^\w\s]", " ", tekst)
        woorden = tekst.split()
        for woord in woorden:
            if len(woord) > 3 and woord not in stopwoorden:
                kernwoorden.add(woord)

    return list(kernwoorden)


def vraag_bevat_verboden_woord(user_input: str, kernwoorden: list[str]) -> bool:
    """
    Controleert of de input van de leerling een kernwoord bevat
    dat uit de opdrachtvragen komt.
    """
    invoer = user_input.lower()
    invoer = re.sub(r"[^\w\s]", " ", invoer)
    invoer_woorden = set(invoer.split())

    for kern in kernwoorden:
        # Exacte match
        if kern in invoer_woorden:
            return True
        # Gedeeltelijke match voor samengestelde woorden
        # bijv. "markteconomie" matcht op "markt" en "economie"
        if kern in invoer:
            return True

    return False


def antwoord_bevat_verboden_woord(ai_antwoord: str, kernwoorden: list[str]) -> bool:
    """
    Controleert of het AI-antwoord kernwoorden uit de opdracht uitlegt.
    Als de AI een definitie geeft van een verboden begrip, blokkeren we het.
    """
    antwoord = ai_antwoord.lower()
    for kern in kernwoorden:
        if kern in antwoord:
            return True
    return False


# ============ ENDPOINTS ============

@router.post("/tutor/chat")
async def tutor_chat(body: TutorChatBody):
    """AI tutor voor studenten — helpt bij stof maar geeft NOOIT antwoorden."""
    try:
        try:
            context_data = json.loads(body.opdracht_context)
            vragen_lijst = context_data.get("vragen", [])
        except Exception:
            vragen_lijst = []

        kernwoorden = extract_kernwoorden(vragen_lijst)

        # ══════════════════════════════════════
        # HARDE CHECK 1: Bevat de vraag van de leerling een verboden kernwoord?
        # ══════════════════════════════════════
        if vraag_bevat_verboden_woord(body.content, kernwoorden):
            return {"message": BLOKKEER_ANTWOORD}

        # ══════════════════════════════════════
        # HARDE CHECK 2: Bevat de gesprekshistorie recent een verboden onderwerp?
        # Als de laatste 2 berichten van de leerling over verboden stof gingen,
        # dan is de kans groot dat dit bericht een doorvraag is.
        # ══════════════════════════════════════
        recente_user_berichten = [
            m["content"] for m in (body.messages or [])
            if m.get("role") == "user"
        ][-2:]  # laatste 2 berichten

        for recent in recente_user_berichten:
            if vraag_bevat_verboden_woord(recent, kernwoorden):
                # Doorvraag op verboden onderwerp — blokkeer ook
                return {"message": BLOKKEER_ANTWOORD}

        # ══════════════════════════════════════
        # AI mag antwoorden — maar met strikte prompt
        # ══════════════════════════════════════
        verboden_tekst = "\n".join([
            f'Vraag {v["nummer"]}: {v["vraag"]}'
            for v in vragen_lijst
        ])

        system_prompt = (
            "Je bent een AI-tutor voor middelbare scholieren.\n"
            "Je helpt leerlingen NADENKEN. Je geeft NOOIT antwoorden op opdrachtvragen.\n\n"
            "De leerling maakt een opdracht met deze vragen — geef hierover NOOIT uitleg:\n"
            f"{verboden_tekst}\n\n"
            "WAT JE WEL MAG:\n"
            "✅ Vragen stellen: 'Wat weet je er zelf al van?'\n"
            "✅ Verwijzen naar het schoolboek\n"
            "✅ Aanmoedigen zonder inhoud te geven\n"
            "✅ Helpen met onderwerpen die NIET in de opdracht staan\n\n"
            "TOON: Max 2 zinnen, informeel, eindig met een vraag terug.\n"
        )

        conversation = list(body.messages) if body.messages else []
        conversation.append({"role": "user", "content": body.content})

        response = await ai_service.generate_response(
            messages=conversation,
            role="student",
            module_prompts=[system_prompt],
        )

        # ══════════════════════════════════════
        # HARDE CHECK 3: Bevat het AI-antwoord toch een verboden begrip?
        # Laatste vangnet.
        # ══════════════════════════════════════
        if antwoord_bevat_verboden_woord(response, kernwoorden):
            return {"message": BLOKKEER_ANTWOORD}

        return {"message": response}

    except Exception as e:
        print(f"❌ TUTOR CHAT error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/nakijken")
async def nakijken(body: NakijkBody):
    try:
        vragen_tekst = ""
        for v in body.antwoorden:
            vragen_tekst += (
                f"\nVraag {v['vraag_nummer']}: {v['vraag_tekst']}\n"
                f"  Max punten: {v['max_punten']}\n"
                f"  Correct antwoord: {v['correct_antwoord']}\n"
                f"  Student antwoord: {v['student_antwoord']}\n"
                f"  Type: {v.get('type', 'open')}\n"
            )

        system_prompt = (
            "Je bent een eerlijke maar empathische nakijkassistent voor middelbare scholieren.\n\n"
            "NAKIJK REGELS:\n"
            "- Meerkeuze/waar-onwaar: exact goed = volle punten, anders 0\n"
            "- Open vragen: beoordeel op inhoudelijke juistheid, niet op exacte woordkeuze\n"
            "- Gedeeltelijk correcte antwoorden krijgen proportioneel punten\n"
            "- Geef altijd een korte, bemoedigende uitleg\n"
            "- Wees eerlijk maar constructief\n\n"
            "UITVOER FORMAT (verplicht exacte JSON, geen tekst eromheen):\n"
            '{"resultaten": [{"vraag_nummer": 1, "punten_behaald": 1, "max_punten": 2, "feedback": "Uitleg..."}], '
            '"totaal_punten": 5, "algemene_feedback": "Korte algemene beoordeling..."}'
        )

        response = await ai_service.generate_response(
            messages=[{"role": "user", "content": f"Kijk deze antwoorden na:\n{vragen_tekst}"}],
            role="teacher",
            module_prompts=[system_prompt],
        )

        try:
            start = response.find('{')
            end = response.rfind('}') + 1
            if start >= 0 and end > start:
                result = json.loads(response[start:end])
            else:
                raise ValueError("Geen JSON gevonden")
        except Exception as parse_err:
            print(f"⚠️ Kon nakijk JSON niet parsen: {parse_err}")
            return {"raw": response, "error": "Kon JSON niet parsen"}

        try:
            totaal = result.get("totaal_punten", 0)
            supabase.table("assignment_submissions").update({
                "totaal_punten": totaal,
                "ai_nakijk_status": "done",
                "antwoorden": [
                    {**ant, "nakijk": next(
                        (r for r in result.get("resultaten", []) if r["vraag_nummer"] == ant.get("vraag_nummer")),
                        None
                    )}
                    for ant in body.antwoorden
                ],
                "updated_at": datetime.now().isoformat(),
            }).eq("id", body.submission_id).execute()
        except Exception as db_err:
            print(f"⚠️ Kon nakijk niet opslaan: {db_err}")

        return result

    except Exception as e:
        print(f"❌ NAKIJKEN error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/draft")
async def save_draft(body: SaveDraftBody):
    try:
        existing = supabase.table("assignment_submissions").select("id").eq(
            "assignment_id", body.assignment_id
        ).eq("student_id", body.student_id).execute()

        if existing.data:
            supabase.table("assignment_submissions").update({
                "antwoorden": body.antwoorden,
                "chat_log": body.chat_log,
                "updated_at": datetime.now().isoformat(),
            }).eq("id", existing.data[0]["id"]).execute()
            return {"id": existing.data[0]["id"], "status": "updated"}
        else:
            result = supabase.table("assignment_submissions").insert({
                "assignment_id": body.assignment_id,
                "student_id": body.student_id,
                "class_id": body.class_id,
                "antwoorden": body.antwoorden,
                "chat_log": body.chat_log,
                "ai_nakijk_status": "pending",
            }).execute()
            return {"id": result.data[0]["id"], "status": "created"}
    except Exception as e:
        print(f"❌ DRAFT error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/inleveren")
async def inleveren(body: InleverBody):
    try:
        now = datetime.now().isoformat()
        existing = supabase.table("assignment_submissions").select("id").eq(
            "assignment_id", body.assignment_id
        ).eq("student_id", body.student_id).execute()

        if existing.data:
            result = supabase.table("assignment_submissions").update({
                "antwoorden": body.antwoorden,
                "chat_log": body.chat_log,
                "max_punten": body.max_punten,
                "ai_nakijk_status": "nakijken",
                "ingeleverd_op": now,
                "updated_at": now,
            }).eq("id", existing.data[0]["id"]).select().execute()
            return result.data[0]
        else:
            result = supabase.table("assignment_submissions").insert({
                "assignment_id": body.assignment_id,
                "student_id": body.student_id,
                "class_id": body.class_id,
                "antwoorden": body.antwoorden,
                "chat_log": body.chat_log,
                "max_punten": body.max_punten,
                "ai_nakijk_status": "nakijken",
                "ingeleverd_op": now,
            }).select().execute()
            return result.data[0]
    except Exception as e:
        print(f"❌ INLEVEREN error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/student/{student_id}/assignment/{assignment_id}")
async def get_submission(student_id: str, assignment_id: str):
    try:
        result = supabase.table("assignment_submissions").select("*").eq(
            "assignment_id", assignment_id
        ).eq("student_id", student_id).execute()
        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))