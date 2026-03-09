from openai import AsyncOpenAI
from typing import List
import os
from dotenv import load_dotenv

# Force load .env file
load_dotenv()

class AIService:
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        self.client = AsyncOpenAI(api_key=api_key)
    
    async def generate_response(
        self,
        messages: List[dict],
        role: str = "student",
        images: List[str] = None,
        module_prompts: List[str] = None
    ) -> str:
        """
        Generate AI response with optional image support and module-based prompts
        """
        try:
            # Build system prompt from modules
            if module_prompts and len(module_prompts) > 0:
                # Use active module prompts
                combined_prompt = "\n\n".join(module_prompts)
                system_content = f"Je bent ClarusAI. Volg deze instructies:\n\n{combined_prompt}"
            else:
                # Fallback to role-based prompts
                system_prompts = {
                    "student": "Je bent een behulpzame AI assistent voor studenten. Geef duidelijke, educatieve antwoorden.",
                    "teacher": "Je bent een AI assistent voor docenten. Help met lesmateriaal en didactische vragen.",
                    "admin": "Je bent een AI assistent voor beheerders. Help met administratieve taken."
                }
                system_content = system_prompts.get(role, system_prompts["student"])
            
            system_message = {
                "role": "system",
                "content": system_content
            }
            
            # Format messages for OpenAI
            formatted_messages = [system_message]
            
            for msg in messages:
                # Check if this is the last user message and we have images
                is_last_user_msg = (msg == messages[-1] and msg.get("role") == "user")
                
                if is_last_user_msg and images:
                    # Create content array with text + images
                    content = [{"type": "text", "text": msg["content"]}]
                    
                    # Add images
                    for img_base64 in images:
                        if img_base64:
                            content.append({
                                "type": "image_url",
                                "image_url": {"url": img_base64}
                            })
                    
                    formatted_messages.append({
                        "role": "user",
                        "content": content
                    })
                else:
                    formatted_messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
            
            # Call OpenAI with vision support
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=formatted_messages,
                max_tokens=4000,
                temperature=0.7,
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            print(f"Error generating AI response: {e}")
            raise

# Singleton instance
ai_service = AIService()