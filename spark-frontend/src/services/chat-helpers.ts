import { API_URL } from '@/config'

export const getActiveModuleIds = async (userId: string): Promise<string[]> => {
  try {
    const res = await fetch(`${API_URL}/api/modules?user_id=${userId}`)
    if (!res.ok) return []
    const modules = await res.json()
    return modules.filter((m: any) => m.is_active).map((m: any) => m.id)
  } catch (error) {
    console.error('Error loading module IDs:', error)
    return []
  }
}

export const getActiveModulePrompts = async (userId: string): Promise<string[]> => {
  try {
    const res = await fetch(`${API_URL}/api/modules?user_id=${userId}`)
    if (!res.ok) return []
    const modules = await res.json()
    const activeModules = modules.filter((m: any) => m.is_active)
    if (activeModules.length === 0) return []
    return activeModules.map((m: any) => `📌 ${m.name}:\n${m.system_prompt}`)
  } catch (error) {
    console.error('Error loading modules:', error)
    return []
  }
}

export const getActiveEbookContent = async (ebookId: string | null): Promise<string> => {
  if (!ebookId) return ''
  try {
    const res = await fetch(`${API_URL}/api/ebooks/${ebookId}/text`)
    if (!res.ok) return ''
    const data = await res.json()
    if (!data.text || data.text_length === 0) return ''

    const maxLength = 50000
    const text = data.text.length > maxLength
      ? data.text.substring(0, maxLength) + '\n\n[... rest van het boek afgekort ...]'
      : data.text

    return `📚 ACTIEF EBOOK: "${data.title}" door ${data.author}\n\nHieronder staat de inhoud van het schoolboek:\n\n${text}\n\n---\n\n⚠️ INSTRUCTIE: De gebruiker heeft dit schoolboek actief. Gebruik de bovenstaande tekst om vragen te beantwoorden. Verwijs naar specifieke pagina's of hoofdstukken uit het boek wanneer relevant.`
  } catch (error) {
    console.error('Error loading ebook content:', error)
    return ''
  }
}