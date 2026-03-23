from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.config import settings
from supabase import create_client, Client

router = APIRouter(prefix="/api/modules", tags=["modules"])

# Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


# Pydantic models
class ModuleCreate(BaseModel):
    user_id: str
    name: str
    description: Optional[str] = ""
    system_prompt: str
    icon: Optional[str] = ""
    is_active: Optional[bool] = True


class ModuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class ModuleResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = ""
    system_prompt: str
    icon: Optional[str] = ""
    is_active: bool
    created_at: datetime
    updated_at: datetime


# GET /api/modules?user_id= — Alle modules voor een user
@router.get("", response_model=List[ModuleResponse])
async def get_modules(user_id: str):
    """Get all modules for a specific user"""
    try:
        response = supabase.table("modules").select("*").eq("user_id", user_id).order("created_at", desc=False).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/modules — Nieuwe module aanmaken
@router.post("", response_model=ModuleResponse)
async def create_module(module: ModuleCreate):
    """Create a new module"""
    try:
        print(f"🔍 DEBUG CREATE MODULE:")
        print(f"  user_id: {module.user_id}")
        print(f"  name: {module.name}")
        print(f"  description: {module.description}")
        print(f"  system_prompt: {module.system_prompt[:50]}...")
        print(f"  icon: {module.icon}")
        print(f"  is_active: {module.is_active}")

        insert_data = {
            "user_id": module.user_id,
            "name": module.name,
            "description": module.description or "",
            "system_prompt": module.system_prompt,
            "icon": module.icon or "",
            "is_active": module.is_active if module.is_active is not None else True,
        }
        print(f"  insert_data: {insert_data}")

        response = supabase.table("modules").insert(insert_data).execute()
        print(f"✅ Module created: {response.data}")
        return response.data[0]
    except Exception as e:
        print(f"❌ ERROR creating module: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# PUT /api/modules/{module_id} — Module bijwerken
@router.put("/{module_id}", response_model=ModuleResponse)
async def update_module(module_id: str, module: ModuleUpdate):
    """Update an existing module"""
    try:
        update_data = {}
        if module.name is not None:
            update_data["name"] = module.name
        if module.description is not None:
            update_data["description"] = module.description
        if module.system_prompt is not None:
            update_data["system_prompt"] = module.system_prompt
        if module.icon is not None:
            update_data["icon"] = module.icon
        if module.is_active is not None:
            update_data["is_active"] = module.is_active

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        response = supabase.table("modules").update(update_data).eq("id", module_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Module not found")

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# DELETE /api/modules/{module_id} — Module verwijderen
@router.delete("/{module_id}")
async def delete_module(module_id: str):
    """Permanently delete a module"""
    try:
        response = supabase.table("modules").delete().eq("id", module_id).execute()
        return {"message": "Module deleted", "module_id": module_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))