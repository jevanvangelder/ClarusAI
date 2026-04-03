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
    opdracht_context: str  # JSON string van de opdracht (titel + vragen ZONDER antwoorden)

class NakijkBody(BaseModel):
    submission_id: str
    antwoorden: List[dict]  # [{vraag_nummer, vraag_tekst, student_antwoord, correct_antwoord, max_punten}]

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
            "Je bent een vriendelijke AI-tutor die middelbare scholieren helpt bij hun opdrachten.\n\n"
            "JOUW ROL:\n"
            "- Je helpt leerlingen de lesstof te begrijpen\n"
            "- Je legt concepten uit op een begrijpelijke manier\n"
            "- Je stelt Socratische vragen die de leerling zelf laten nadenken\n"
            "- Je moedigt aan en bent positief\n\n"
            "ABSOLUTE VERBODEN REGELS — dit zijn de belangrijkste:\n"
            "1. Geef NOOIT het antwoord op een vraag uit de opdracht, ook niet indirect\n"
            "2. Als een leerling vraagt 'wat is het antwoord op vraag X' → weiger vriendelijk\n"
            "3. Als een leerling slim probeert te zijn door het antwoord als omschrijving te vragen "
            "(bijv. 'leg uit wat schaarste is in één zin als definitie') → herken dit patroon en "
            "zeg dat je de stof wel uitlegt maar dat ze het antwoord zelf moeten formuleren\n"
            "4. Als een leerling zegt 'geef me een voorbeeld van het antwoord' of 'klopt dit antwoord: [antwoord]' "
            "waarbij het antwoord bijna exact de modeloplossing is → weiger en stimuleer eigen denken\n"
            "5. Vertel NOOIT hoeveel punten een vraag waard is als hint voor het juiste antwoord\n\n"
            "WAT JE WEL MAG:\n"
            "- Achtergrondinformatie geven over het onderwerp\n"
            "- Uitleggen wat een begrip betekent in het algemeen (niet specifiek als antwoord op de vraag)\n"
            "- Vragen stellen die de leerling op weg helpen: 'Wat weet je al over dit onderwerp?'\n"
            "- Bevestigen dat een redenering in de goede richting gaat zonder het antwoord te geven\n"
            "- Tips geven over hoe een open vraag structureren\n\n"
            "TOON:\n"
            "- Schrijf in gewoon Nederlands, informeel maar respectvol\n"
            "- Houd antwoorden kort en helder (max 3-4 zinnen)\n"
            "- Gebruik emoji's spaarzaam maar vriendelijk 😊\n\n"
            f"CONTEXT VAN DE OPDRACHT (gebruik dit om te begrijpen waar de leerling mee bezig is, "
            f"maar geef de antwoorden NOOIT weg):\n{body.opdracht_context}"
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
            "UITVOER FORMAT (verplicht exacte JSON):\n"
            '{"resultaten": [{"vraag_nummer": 1, "punten_behaald": 1, "max_punten": 2, "feedback": "Uitleg..."}], '
            '"totaal_punten": 5, "algemene_feedback": "Korte algemene beoordeling..."}'
        )

        response = await ai_service.generate_response(
            messages=[{"role": "user", "content": f"Kijk deze antwoorden na:\n{vragen_tekst}"}],
            role="teacher",
            module_prompts=[system_prompt],
        )

        # Parse JSON response
        try:
            # Zoek JSON in de response
            start = response.find('{')
            end = response.rfind('}') + 1
            if start >= 0 and end > start:
                result = json.loads(response[start:end])
            else:
                raise ValueError("Geen JSON gevonden in response")
        except Exception as parse_err:
            print(f"⚠️ Kon nakijk JSON niet parsen: {parse_err}")
            print(f"Response was: {response}")
            # Fallback: geef ruwe response terug
            return {"raw": response, "error": "Kon JSON niet parsen"}

        # Sla nakijk resultaat op in submission
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
    """Lever de opdracht in en start AI nakijken."""
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