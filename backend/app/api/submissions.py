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


# ============ HELPERS ============

def extract_keywords_from_vragen(vragen: list) -> list[str]:
    """
    Haalt sleutelwoorden op uit de vragen zodat de AI weet
    over welke begrippen hij NIETS mag uitleggen.
    We sturen de volledige vraagtekst mee — niet filteren, want
    de AI moet zelf matchen op basis van de exacte vraagtekst.
    """
    return [f'Vraag {v["nummer"]}: {v["vraag"]}' for v in vragen]


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

        # Volledige vraagteksten als verboden lijst
        verboden_vragen = extract_keywords_from_vragen(vragen_lijst)
        verboden_tekst = "\n".join(verboden_vragen)

        # Alle kernbegrippen die in de vragen voorkomen
        # Dit helpt de AI patronen te herkennen zoals "rente", "inflatie" etc.
        kernbegrippen = []
        begrip_mapping = {
            "schaarste": ["schaarste", "schaars"],
            "goed": ["goed", "goederen", "tastbaar product"],
            "vrije markteconomie": ["vrije markteconomie", "markteconomie", "vrije markt"],
            "micro": ["micro-economie", "micro economie", "microeconomie"],
            "macro": ["macro-economie", "macro economie", "macroeconomie"],
            "productiefactor": ["productiefactor", "productiefactoren", "kapitaal", "arbeid"],
            "inflatie": ["inflatie", "prijsniveau", "prijsstijging"],
            "rente": ["rente", "renteverhoging", "renteverlaging", "rentepercentage"],
            "vraag en aanbod": ["vraag", "aanbod", "prijs stijgt", "prijs daalt"],
            "bbp": ["bbp", "bruto binnenlands product", "economische prestatie"],
            "monopolie": ["monopolie", "marktstructuur", "aanbieder"],
        }

        for v in vragen_lijst:
            vraag_lower = v["vraag"].lower()
            for begrip, synoniemen in begrip_mapping.items():
                if any(s in vraag_lower for s in synoniemen):
                    kernbegrippen.append(begrip)

        kernbegrippen_tekst = ", ".join(set(kernbegrippen)) if kernbegrippen else "zie de vragen hierboven"

        system_prompt = (
            "Je bent een AI-tutor voor middelbare scholieren.\n"
            "Je helpt leerlingen NADENKEN over de stof. Je geeft NOOIT antwoorden op opdrachtvragen.\n\n"

            "╔══════════════════════════════════════╗\n"
            "║  VERBODEN ONDERWERPEN — LEES DIT GOED ║\n"
            "╚══════════════════════════════════════╝\n"
            "De leerling maakt een opdracht met deze exacte vragen:\n\n"
            f"{verboden_tekst}\n\n"
            f"De kernbegrippen uit deze opdracht zijn: {kernbegrippen_tekst}\n\n"
            "REGEL: Als een leerling vraagt naar de BETEKENIS, DEFINITIE, UITLEG of een VOORBEELD "
            "van een van deze kernbegrippen of de onderwerpen in bovenstaande vragen — "
            "ook als ze het anders formuleren — dan geef je ALTIJD en ALLEEN dit antwoord:\n\n"
            "  🚫 Dat lijkt op een vraag uit je opdracht! Dat antwoord moet van jou komen. "
            "Heb je het al in je schoolboek opgezocht? Wat weet je er zelf al van?\n\n"
            "Dit geldt ook voor:\n"
            "- 'Een ander woord voor X?'\n"
            "- 'Kun je X uitleggen?'\n"
            "- 'Wat is X precies?'\n"
            "- 'Klopt het dat X betekent...?'\n"
            "- 'Leg X simpel uit'\n"
            "- 'Wat zijn voorbeelden van X?'\n"
            "- Elke andere manier om de definitie of uitleg van X te krijgen\n\n"

            "╔══════════════════════════════════════╗\n"
            "║  WAT JE WEL MAG                       ║\n"
            "╚══════════════════════════════════════╝\n"
            "✅ Vragen stellen: 'Wat weet je er zelf al van?'\n"
            "✅ Verwijzen naar het schoolboek: 'Dit staat in jullie boek'\n"
            "✅ Helpen met de STRUCTUUR van een antwoord (niet de inhoud)\n"
            "✅ Aanmoedigen zonder inhoud te geven\n"
            "✅ Vragen beantwoorden die NIET gaan over de opdrachtstof\n\n"

            "╔══════════════════════════════════════╗\n"
            "║  TOON                                  ║\n"
            "╚══════════════════════════════════════╝\n"
            "- Max 2 zinnen per antwoord\n"
            "- Informeel en vriendelijk\n"
            "- Eindig altijd met een vraag terug\n"
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