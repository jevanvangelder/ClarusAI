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