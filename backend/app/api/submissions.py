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

BLOKKEER_ANTWOORD = (
    "🚫 Dat is precies wat de opdracht vraagt! Dat antwoord moet van jou komen. "
    "Heb je het al in je schoolboek opgezocht? Wat weet je er zelf al van?"
)


async def is_verboden_vraag(
    user_input: str,
    chat_history: list,
    vragen_lijst: list
) -> bool:
    verboden_tekst = "\n".join([
        f'Vraag {v["nummer"]}: {v["vraag"]}'
        for v in vragen_lijst
    ])

    recente_context = ""
    for m in chat_history[-4:]:
        rol = "Leerling" if m.get("role") == "user" else "Tutor"
        recente_context += f"{rol}: {m.get('content', '')}\n"

    check_prompt = (
        "Je bent een beveiligingssysteem voor een AI-tutor op een middelbare school.\n"
        "Je beoordeelt of de vraag van een leerling leidt naar het antwoord op een opdrachtvraag.\n\n"
        f"OPDRACHTVRAGEN:\n{verboden_tekst}\n\n"
        f"RECENTE GESPREKSCONTEXT:\n{recente_context}\n"
        f"NIEUWE VRAAG VAN LEERLING: {user_input}\n\n"
        "STAPPENPLAN:\n"
        "Stap 1: Wat zou het antwoord zijn op de vraag van de leerling?\n"
        "Stap 2: Staat dat antwoord (of een directe hint ernaar) ook als antwoord "
        "op een van de opdrachtvragen?\n"
        "Stap 3: Zo ja → JA. Zo nee → NEE.\n\n"
        "BLOKKEER (JA) alleen als het antwoord op de leerlingvraag EXACT overeenkomt "
        "met het antwoord op een opdrachtvraag, of er een directe hint naar geeft.\n\n"
        "NIET BLOKKEREN (NEE) als:\n"
        "- De vraag gaat over een begrip dat NIET als opdrachtvraag voorkomt\n"
        "- De vraag breder is dan een specifieke opdrachtvraag\n"
        "- De vraag gaat over schrijftips, studieadvies of hoe je een antwoord structureert\n"
        "- Het antwoord de leerling niet helpt bij het invullen van een specifieke opdrachtvraag\n\n"
        "VOORBEELDEN VAN DE REDENERING:\n"
        "Opdracht vraagt: 'Wat is de functie van mitochondriën?'\n"
        "  Leerling: 'Wat doen mitochondriën?' → JA\n"
        "  Leerling: 'Wat zijn organellen?' → NEE\n\n"
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
        return False


# ============ ENDPOINTS ============

@router.post("/tutor/chat")
async def tutor_chat(body: TutorChatBody):
    try:
        try:
            context_data = json.loads(body.opdracht_context)
            vragen_lijst = context_data.get("vragen", [])
        except Exception:
            vragen_lijst = []

        geblokkeerd = await is_verboden_vraag(
            user_input=body.content,
            chat_history=body.messages or [],
            vragen_lijst=vragen_lijst,
        )
        if geblokkeerd:
            return {"message": BLOKKEER_ANTWOORD}

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
            f"{verboden_tekst}\n\n"
            "╔══════════════════════════════════════╗\n"
            "║  HOE JE ÉCHT HELPT                    ║\n"
            "╚══════════════════════════════════════╝\n"
            "✅ Leg begrippen uit die NIET in de opdracht staan\n"
            "✅ Geef ALTIJD een simpel praktijkvoorbeeld uit het dagelijks leven\n"
            "✅ Stel een vervolgvraag: 'Wat zou jij doen in die situatie?'\n"
            "✅ Geef hints zonder het antwoord te geven\n"
            "✅ Moedig aan en wees positief\n\n"
            "TOON: Informeel, warm — praat als een coole oudere broer/zus. Max 4 zinnen.\n"
        )

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
                f"\nVraag {v['vraag_nummer']} (type: {v.get('type', 'open')}, max: {v['max_punten']}pt):\n"
                f"  Vraag: {v['vraag_tekst']}\n"
                f"  Correct antwoord: {v.get('correct_antwoord', '')}\n"
                f"  Student antwoord: {v['student_antwoord']}\n"
            )

        system_prompt = (
            "Je bent een eerlijke maar empathische nakijkassistent voor middelbare scholieren.\n\n"
            "NAKIJK REGELS:\n"
            "- Meerkeuze/waar-onwaar: exact goed = volle punten, anders 0. Geen halve punten.\n"
            "- Open vragen: beoordeel op inhoudelijke juistheid, niet op exacte woordkeuze.\n"
            "  Gedeeltelijk correcte antwoorden krijgen proportioneel punten.\n"
            "- Geef altijd een korte, bemoedigende feedback.\n"
            "- Bij open vragen: geef ook een 'beredenering' waarin je uitlegt WAAROM je\n"
            "  dit aantal punten geeft (max 2 zinnen, concreet en eerlijk).\n\n"
            "UITVOER FORMAT (verplicht exacte JSON, geen tekst eromheen):\n"
            '{\n'
            '  "resultaten": [\n'
            '    {\n'
            '      "vraag_nummer": 1,\n'
            '      "punten_behaald": 2,\n'
            '      "max_punten": 2,\n'
            '      "feedback": "Kort bemoedigend commentaar.",\n'
            '      "beredenering": "Alleen bij open vragen: waarom dit aantal punten. Weglaten bij meerkeuze/waar-onwaar."\n'
            '    }\n'
            '  ],\n'
            '  "totaal_punten": 5,\n'
            '  "algemene_feedback": "Korte algemene beoordeling van de hele opdracht."\n'
            '}'
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
            supabase.table("assignment_submissions").update({
                "antwoorden": body.antwoorden,
                "chat_log": body.chat_log,
                "max_punten": body.max_punten,
                "ai_nakijk_status": "nakijken",
                "ingeleverd_op": now,
                "updated_at": now,
            }).eq("id", existing.data[0]["id"]).execute()

            result = supabase.table("assignment_submissions").select("*").eq(
                "id", existing.data[0]["id"]
            ).single().execute()
            return result.data
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
            }).execute()
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