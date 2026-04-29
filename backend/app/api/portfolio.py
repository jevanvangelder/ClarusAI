from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.config import settings
from supabase import create_client, Client
import os
import uuid

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
supabase_admin: Client = create_client(settings.SUPABASE_URL, os.getenv("SUPABASE_SERVICE_KEY", settings.SUPABASE_KEY))

PORTFOLIO_BUCKET = "portfolio-files"


# ============ MODELS ============

class PortfolioAssignmentCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    class_ids: List[str] = []
    deadline: Optional[str] = None
    max_points: Optional[int] = 10

class PortfolioAssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    max_points: Optional[int] = None
    is_active: Optional[bool] = None

class PortfolioGrade(BaseModel):
    points_awarded: int
    feedback: Optional[str] = ""


# ============ ENDPOINTS ============

@router.get("/assignments")
async def get_portfolio_assignments(teacher_id: Optional[str] = None, student_id: Optional[str] = None):
    """Haal portfolio opdrachten op (voor docent of student)"""
    try:
        if teacher_id:
            # Docent: eigen opdrachten
            response = supabase.table("portfolio_assignments")\
                .select("*, portfolio_assignment_classes(class_id, deadline)")\
                .eq("created_by", teacher_id)\
                .eq("is_active", True)\
                .order("created_at", desc=True)\
                .execute()
        elif student_id:
            # Student: opdrachten van klassen waar student lid van is
            # Eerst klassen ophalen
            classes_resp = supabase.table("class_members")\
                .select("class_id")\
                .eq("student_id", student_id)\
                .execute()
            
            if not classes_resp.data:
                return []
            
            class_ids = [c["class_id"] for c in classes_resp.data]
            
            # Opdrachten van die klassen
            response = supabase.table("portfolio_assignment_classes")\
                .select("*, portfolio_assignments(*)")\
                .in_("class_id", class_ids)\
                .execute()
        else:
            raise HTTPException(status_code=400, detail="teacher_id of student_id vereist")
        
        return response.data
    except Exception as e:
        print(f"❌ Error ophalen portfolio opdrachten: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assignments")
async def create_portfolio_assignment(assignment: PortfolioAssignmentCreate, teacher_id: str):
    """Maak een nieuwe portfolio opdracht aan (docent/staff)"""
    try:
        # Maak opdracht aan
        insert_data = {
            "title": assignment.title,
            "description": assignment.description or "",
            "created_by": teacher_id,
            "max_points": assignment.max_points or 10,
            "is_active": True,
        }
        
        response = supabase.table("portfolio_assignments").insert(insert_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Kon opdracht niet aanmaken")
        
        assignment_id = response.data[0]["id"]
        
        # Koppel aan klassen
        if assignment.class_ids:
            class_links = []
            for class_id in assignment.class_ids:
                class_links.append({
                    "assignment_id": assignment_id,
                    "class_id": class_id,
                    "deadline": assignment.deadline,
                })
            
            supabase.table("portfolio_assignment_classes").insert(class_links).execute()
        
        return response.data[0]
    except Exception as e:
        print(f"❌ Error aanmaken portfolio opdracht: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submit")
async def submit_portfolio(
    assignment_id: str = Form(...),
    student_id: str = Form(...),
    class_id: str = Form(...),
    file: UploadFile = File(...),
):
    """Student levert portfolio opdracht in"""
    try:
        # Upload bestand naar Supabase Storage
        file_bytes = await file.read()
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
        unique_name = f"{uuid.uuid4()}.{file_ext}"
        storage_path = f"submissions/{student_id}/{unique_name}"
        
        supabase_admin.storage.from_(PORTFOLIO_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": file.content_type or "application/pdf"}
        )
        
        file_url = supabase_admin.storage.from_(PORTFOLIO_BUCKET).get_public_url(storage_path)
        
        # Sla inzending op in database
        submission_data = {
            "assignment_id": assignment_id,
            "student_id": student_id,
            "class_id": class_id,
            "file_url": file_url,
            "file_name": file.filename,
            "file_size": len(file_bytes),
            "file_type": file.content_type,
            "status": "pending",
        }
        
        response = supabase.table("portfolio_submissions")\
            .upsert(submission_data, on_conflict="assignment_id,student_id")\
            .execute()
        
        return response.data[0]
    except Exception as e:
        print(f"❌ Error inleveren portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submissions")
async def get_submissions(assignment_id: Optional[str] = None, student_id: Optional[str] = None):
    """Haal inleveringen op (voor docent of student)"""
    try:
        query = supabase.table("portfolio_submissions").select("*")
        
        if assignment_id:
            query = query.eq("assignment_id", assignment_id)
        if student_id:
            query = query.eq("student_id", student_id)
        
        response = query.order("submitted_at", desc=True).execute()
        return response.data
    except Exception as e:
        print(f"❌ Error ophalen inleveringen: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submissions/{submission_id}/grade")
async def grade_submission(submission_id: str, grade: PortfolioGrade, teacher_id: str):
    """Beoordeel een portfolio inlevering (docent)"""
    try:
        update_data = {
            "points_awarded": grade.points_awarded,
            "feedback": grade.feedback or "",
            "graded_by": teacher_id,
            "graded_at": datetime.now().isoformat(),
            "status": "graded",
        }
        
        response = supabase.table("portfolio_submissions")\
            .update(update_data)\
            .eq("id", submission_id)\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Inlevering niet gevonden")
        
        return response.data[0]
    except Exception as e:
        print(f"❌ Error beoordelen portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/assignments/{assignment_id}")
async def delete_portfolio_assignment(assignment_id: str):
    """Verwijder een portfolio opdracht"""
    try:
        supabase.table("portfolio_assignments").delete().eq("id", assignment_id).execute()
        return {"message": "Portfolio opdracht verwijderd"}
    except Exception as e:
        print(f"❌ Error verwijderen portfolio opdracht: {e}")
        raise HTTPException(status_code=500, detail=str(e))