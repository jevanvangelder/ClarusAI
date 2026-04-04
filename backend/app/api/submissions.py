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
    "🚫 Dat is precies wat de opdracht vraagt! Dat antwoord moet van jou komen. "
    "Heb je het al in je schoolboek opgezocht? Wat weet je er zelf al van?"
)

# Directe definitiepatronen — snelle Python check vóór de AI
DEFINITIE_PATRONEN = [
    r"\bwat is\b",
    r"\bwat zijn\b",
    r"\bwat betekent\b",
    r"\bwat betekenen\b",
    r"\bdefinieer\b",
    r"\bdefinitie van\b",
    r"\bomschrijf\b",
    r"\bleg uit wat\b",
    r"\buitleggen wat\b",
    r"\bverklaar\b",
]

def is_definitie_vraag(tekst: str) -> bool:
    tekst_lower = tekst.lower()
    for patroon in DEFINITIE_PATRONEN:
        if re.search(patroon, tekst_lower):
            return True
    return False


def get_vakbegrippen(vragen: list) -> list[str]:
    """
    Haalt vakspecifieke kernbegrippen op uit de vraagteksten.
    Filtert stopwoorden eruit zodat alleen echte vakbegrippen overblijven.
    """
    stopwoorden = {
        "welke", "volgende", "voorbeeld", "stelling", "tussen", "invloed",
        "heeft", "hebben", "wordt", "worden", "bepaal", "bepaalt", "stijgt",
        "daalt", "nemen", "maken", "geven", "doen", "zien", "kunnen",
        "moeten", "mogen", "willen", "gaan", "komen", "staan", "grote",
        "kleine", "eerste", "tweede", "derde", "laatste", "product",
        "producten", "goederen", "diensten", "prijs", "prijzen", "markt",
        "markten", "economie", "economisch", "bedrijf", "bedrijven",
        "overheid", "mensen", "persoon", "individu", "land", "landen",
        "waarde", "waarden", "kosten", "opbrengst", "winst", "verlies",
        "vraag", "aanbod", "stijging", "daling", "factor", "factoren",
        "verschil", "invloed", "gevolg", "oorzaak", "reden", "soort",
        "soorten", "uitleg", "uitleggen", "beschrijf", "noem", "geef",
        "stel", "waar", "onwaar", "juist", "onjuist", "correct",
    }
    begrippen = set()
    for v in vragen:
        tekst = v.get("vraag", "").lower()
        tekst = re.sub(r"[^\w\s]", " ", tekst)
        for woord in tekst.split():
            if len(woord) >= 6 and woord not in stopwoorden:
                begrippen.add(woord)
    return list(begrippen)


def invoer_bevat_vakbegrip(tekst: str, begrippen: list[str]) -> bool:
    tekst_lower = re.sub(r"[^\w\s]", " ", tekst.lower())
    for begrip in begrippen:
        if begrip in tekst_lower:
            return True
    return False


def is_directe_verboden_vraag(tekst: str, begrippen: list[str]) -> bool:
    """Snelle check: definitievraag + vakbegrip = direct blokkeren."""
    return is_definitie_vraag(tekst) and invoer_bevat_vakbegrip(tekst, begrippen)


async def is_indirecte_omzeiling(
    user_input: str,
    chat_history: list,
    vragen_lijst: list
) -> bool:
    """
    Vraagt een snelle AI-check: leidt deze vraag (direct of via de context
    van het gesprek) naar het antwoord op een opdrachtvraag?
    Geeft True terug als het geblokkeerd moet worden.
    """
    verboden_tekst = "\n".join([
        f'Vraag {v["nummer"]}: {v["vraag"]}'
        for v in vragen_lijst
    ])

    # Laatste 4 berichten als context meegeven
    recente_context = ""
    for m in chat_history[-4:]:
        rol = "Leerling" if m.get("role") == "user" else "Tutor"
        recente_context += f"{rol}: {m.get('content', '')}\n"

    check_prompt = (
        "Je bent een beveiligingssysteem voor een AI-tutor. "
        "Je taak is te beoordelen of een vraag van een leerling leidt naar "
        "het antwoord op een van de opdrachtvragen.\n\n"
        f"OPDRACHTVRAGEN:\n{verboden_tekst}\n\n"
        f"RECENTE GESPREKSCONTEXT:\n{recente_context}\n"
        f"NIEUWE VRAAG VAN LEERLING: {user_input}\n\n"
        "Beoordeel: leidt deze vraag (direct OF via de gesprekscontext) naar "
        "het antwoord op een van de opdrachtvragen?\n\n"
        "Voorbeelden die JA zijn:\n"
        "- 'Het tegenovergestelde van deflatie?' → antwoord is inflatie → staat in vraag 6 → JA\n"
        "- 'Stel er is maar 1 aanbieder, hoe heet dat?' → antwoord is monopolie → staat in vraag 10 → JA\n"
        "- 'Waarom heet het spel Monopoly zo?' → legt monopolie uit → staat in vraag 10 → JA\n"
        "- 'Wat zijn de andere twee schalen?' na gesprek over meso → micro/macro → vraag 4 → JA\n"
        "- 'Klopt het dat schaarste betekent dat er te weinig is?' → vraag 1 → JA\n\n"
        "Voorbeelden die NEE zijn:\n"
        "- 'Wat is een dienst?' → staat niet in de opdracht → NEE\n"
        "- 'Hoe schrijf ik een goed antwoord?' → algemeen → NEE\n"
        "- 'Welke marktstructuren zijn er?' → staat niet in de opdracht → NEE\n"
        "- 'Wat is deflatie?' → staat niet in de opdracht → NEE\n"
        "- 'Wat zijn organellen?' → algemeen begrip, staat niet als vraag in de opdracht → NEE\n"
        "- 'Wat is het verschil tussen prokaryoten en eukaryoten?' → bredere uitlegvraag, niet letterlijk de opdrachtvraag → NEE\n"
        "- 'Wat is het verschil tussen sparen en lenen?' → staat niet in de opdracht → NEE\n"
        "- 'Ik snap vraag en aanbod niet' → vraag om uitleg van concept, niet om antwoord → NEE\n"
        "- 'Wat is osmose?' → algemeen begrip buiten de opdracht → NEE\n"
        "- 'Wat is DNA?' → algemeen begrip buiten de opdracht → NEE\n\n"
        "Antwoord met ALLEEN het woord JA of NEE, niets anders."
    )

    try:
        result = await ai_service.generate_response(
            messages=[{"role": "user", "content": check_prompt}],
            role="student",
            module_prompts=[],
        )
        return result.strip().upper().startswith("JA")
    except Exception:
        # Bij twijfel: niet blokkeren, laat de hoofdprompt het afhandelen
        return False


# ============ ENDPOINTS ============

@router.post("/tutor/chat")
async def tutor_chat(body: TutorChatBody):
    """AI tutor voor studenten — helpt écht maar geeft geen opdracht-antwoorden."""
    try:
        try:
            context_data = json.loads(body.opdracht_context)
            vragen_lijst = context_data.get("vragen", [])
        except Exception:
            vragen_lijst = []

        vakbegrippen = get_vakbegrippen(vragen_lijst)

        # ══════════════════════════════════════
        # CHECK 1: Snelle Python check — directe definitievraag over vakbegrip
        # ══════════════════════════════════════
        if is_directe_verboden_vraag(body.content, vakbegrippen):
            return {"message": BLOKKEER_ANTWOORD}

        # ══════════════════════════════════════
        # CHECK 2: AI check — indirecte omzeiling via context of slimme formulering
        # ══════════════════════════════════════
        geblokkeerd = await is_indirecte_omzeiling(
            user_input=body.content,
            chat_history=body.messages or [],
            vragen_lijst=vragen_lijst,
        )
        if geblokkeerd:
            return {"message": BLOKKEER_ANTWOORD}

        # ══════════════════════════════════════
        # Goedgekeurd — laat de tutor antwoorden
        # ══════════════════════════════════════
        verboden_tekst = "\n".join([
            f'Vraag {v["nummer"]}: {v["vraag"]}'
            for v in vragen_lijst
        ])

        system_prompt = (
            "Je bent een enthousiaste en behulpzame AI-tutor voor middelbare scholieren.\n"
            "Je doel: leerlingen écht helpen de stof te begrijpen, zonder de antwoorden te geven.\n\n"

            "╔══════════════════════════════════════╗\n"
            "║  OPDRACHTVRAGEN — NOOIT BEANTWOORDEN  ║\n"
            "╚══════════════════════════════════════╝\n"
            "Op de volgende vragen geef je NOOIT een direct antwoord, definitie of uitleg "
            "die als antwoord gebruikt kan worden:\n\n"
            f"{verboden_tekst}\n\n"
            "Als een leerling alsnog naar het antwoord op een van deze vragen vraagt, zeg je:\n"
            "🚫 Dat is precies wat de opdracht vraagt! Dat antwoord moet van jou komen. "
            "Heb je het al in je schoolboek opgezocht? Wat weet je er zelf al van?\n\n"

            "╔══════════════════════════════════════╗\n"
            "║  HOE JE ÉCHT HELPT                    ║\n"
            "╚══════════════════════════════════════╝\n"
            "✅ Leg begrippen uit die NIET in de opdracht staan\n"
            "✅ Geef ALTIJD een simpel praktijkvoorbeeld uit het dagelijks leven\n"
            "   Gebruik situaties die een 14-16 jarige herkent: winkelen, voetbal,\n"
            "   social media, een bijbaantje, spelletjes, festivals, etc.\n"
            "   LET OP: het voorbeeld mag NOOIT de definitie bevatten die in de opdracht gevraagd wordt\n"
            "✅ Stel een vervolgvraag: 'Wat zou jij doen in die situatie?'\n"
            "✅ Geef hints die de leerling op weg helpen zonder het antwoord te geven\n"
            "✅ Help met de structuur van een goed antwoord\n"
            "✅ Moedig aan en wees positief\n\n"

            "╔══════════════════════════════════════╗\n"
            "║  TOON                                  ║\n"
            "╚══════════════════════════════════════╝\n"
            "- Informeel, warm en aanmoedigend — praat als een coole oudere broer/zus\n"
            "- Gebruik altijd een praktijkvoorbeeld dat een tiener herkent\n"
            "- Max 4 zinnen per antwoord\n"
            "- Eindig altijd met een prikkelende vraag over het voorbeeld\n"
        )

        # Stuur maximaal de laatste 10 berichten mee om context window te beperken
        recente_berichten = (body.messages or [])[-10:]
        conversation = list(recente_berichten)
        conversation.append({"role": "user", "content": body.content})

        response = await ai_service.generate_response(
            messages=conversation,
            role="student",
            module_prompts=[system_prompt],
        )

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