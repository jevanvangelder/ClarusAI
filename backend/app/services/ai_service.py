from openai import OpenAI
from app.core.config import settings
from typing import List, Dict

class AIService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
    
    async def generate_response(
        self, 
        messages: List[Dict[str, str]], 
        role: str = "student"
    ) -> str:
        """
        Generate AI response based on conversation history
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            role: User role (student/teacher) to customize system prompt
        """
        
        # System prompts per role
        system_prompts = {
            "student": """Je bent een behulpzame AI-leerassistent voor ClarusAI. 
                         Je helpt leerlingen met het begrijpen van lesstof. 
                         Geef duidelijke uitleg, gebruik voorbeelden, en stel vragen 
                         om te controleren of de leerling het begrijpt.""",
            
            "teacher": """Je bent een AI-assistent voor docenten in ClarusAI. 
                         Je helpt bij het maken van toetsvragen, het verbeteren 
                         van leesbaarheid, en het genereren van oefenmateriaal."""
        }
        
        # Add system prompt
        full_messages = [
            {"role": "system", "content": system_prompts.get(role, system_prompts["student"])}
        ] + messages
        
        # Call OpenAI API
        response = self.client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            temperature=0.7,
            max_tokens=1000
        )
        
        return response.choices[0].message.content

# Global instance
ai_service = AIService()
