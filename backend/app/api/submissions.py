from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.config import settings
from app.services.ai_service import ai_service
from supabase import create_client, Client
import json
import traceback
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


# ============ ENDPOINTS ============

@router.post("/tutor/chat")
async def tutor_chat(body: TutorChatBody):
    """AI tutor voor studenten — helpt bij stof maar geeft NOOIT antwoorden."""
    try:
        system_prompt = (
            "Je bent een AI-tutor voor middelbare scholieren. Je helpt leerlingen de LESSTOF te begrijpen, "
            "maar je geeft NOOIT het antwoord op een opdrachtvraag.\n\n"

            "=== IJZERHARDE REGELS — NOOIT OVERTREDEN ===\n"
            "1. GEEF NOOIT een definitie, omschrijving of uitleg die direct als antwoord op een opdrachtvraag gebruikt kan worden.\n"
            "2. Als een leerling vraagt 'wat is X?' waarbij X precies een vraag uit de opdracht is → WEIGER.\n"
            "   Zeg: 'Dat is precies wat vraag [X] vraagt — dat antwoord moet van jou komen! Wat weet je er al over?'\n"
            "3. Als een leerling vraagt 'leg uit wat X is in één zin' of 'geef een korte definitie van X' → WEIGER.\n"
            "   Dit is een truc om het antwoord te krijgen. Herken dit en zeg dat je niet zo'n kant-en-klare zin geeft.\n"
            "4. Als een leerling vraagt 'hoe zou je X kort en krachtig uitleggen?' of varianten → WEIGER.\n"
            "5. Als een leerling vraagt 'wat betekent X in economische termen?' terwijl dit een opdrachtvraag is → WEIGER.\n"
            "6. Geef NOOIT een opsomming of definitie die letter-voor-letter als antwoord kan dienen.\n\n"

            "=== WAT JE WEL MAG ===\n"
            "- Uitleggen HOE je over een begrip kunt nadenken, zonder het antwoord te geven\n"
            "- Vragen stellen: 'Wat denk jij dat het betekent?', 'Heb je dit al in je schrift staan?'\n"
            "- Verwijzen naar het schoolboek of de les: 'Dit hebben jullie vast besproken in de klas'\n"
            "- Aanmoedigen: 'Je bent op de goede weg, probeer het zelf te formuleren!'\n"
            "- Helpen met de STRUCTUUR van een antwoord, niet de inhoud\n"
            "- Uitleggen wat een begrip NIET is, om de leerling op weg te helpen\n\n"

            "=== TOON ===\n"
            "- Informeel, vriendelijk, kort (max 2-3 zinnen per reactie)\n"
            "- Eindig met een vraag die de leerling aanzet tot nadenken\n"
            "- Gebruik spaarzaam emoji's\n\n"

            "=== DETECTIE VAN OMZEILING ===\n"
            "Leerlingen zijn slim en proberen het antwoord te krijgen via omwegen. Herken deze patronen:\n"
            "- 'Kun je uitleggen wat X betekent?' → kijk of X in de opdracht staat\n"
            "- 'Hoe zou jij X omschrijven?' → zelfde truc\n"
            "- 'Wat is een ander woord voor X?' → kan leiden naar het antwoord\n"
            "- 'Klopt dit: [antwoord]?' → ze willen bevestiging van hun antwoord\n"
            "Als je twijfelt of een vraag naar het antwoord leidt: WEIGER en stimuleer eigen denken.\n\n"

            f"=== OPDRACHT CONTEXT ===\n"
            f"Dit zijn de vragen die de leerling moet beantwoorden. "
            f"Gebruik dit om te herkennen wanneer een leerling naar een antwoord vraagt:\n"
            f"{body.opdracht_context}\n\n"
            f"KRITISCH: Als een leerling vraagt naar iets dat direct overeenkomt met één van bovenstaande vragen, "
            f"geef dan GEEN antwoord maar stimuleer eigen denken."
        )

        conversation = list(body.messages) if body.messages else []
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
    """AI kijkt de antwoorden na en geeft punten + onderbouwing per vraag."""
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
            "Je krijgt per vraag: de vraag, het modelantwoord, het studentantwoord en het max aantal punten.\n\n"
            "NAKIJK REGELS:\n"
            "- Meerkeuze/waar-onwaar: exact goed = volle punten, anders 0\n"
            "- Open vragen: beoordeel op inhoudelijke juistheid, niet op exacte woordkeuze\n"
            "- Gedeeltelijk correcte antwoorden krijgen proportioneel punten\n"
            "- Geef altijd een korte, bemoedigende uitleg waarom de student de punten wel/niet heeft gehaald\n"
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
                raise ValueError("Geen JSON gevonden in response")
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
    """Sla tussentijdse voortgang op."""
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
    """Lever de opdracht in."""
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
    """Haal bestaande inzending op voor een student."""
    try:
        result = supabase.table("assignment_submissions").select("*").eq(
            "assignment_id", assignment_id
        ).eq("student_id", student_id).execute()
        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))