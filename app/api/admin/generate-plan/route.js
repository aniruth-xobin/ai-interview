
import Groq from 'groq-sdk'

let currentKeyIndex = 0

export async function POST(req) {
  try {
    const { role, description } = await req.json()

    if (!role || !description) {
      return Response.json({ error: 'Role and description are required' }, { status: 400 })
    }

    const keys = []
    for (let i = 1; i <= 6; i++) {
      if (process.env[`GROQ_API_KEY_${i}`]) {
        keys.push(process.env[`GROQ_API_KEY_${i}`])
      }
    }
    
    if (keys.length === 0 && process.env.GROQ_API_KEY) {
      keys.push(process.env.GROQ_API_KEY)
    }

    if (keys.length === 0) {
      return Response.json({ error: 'No Groq API keys found.' }, { status: 500 })
    }

    const prompt = `You are an expert technical recruiter and senior engineering manager.
You have been provided with the following Job Role and Job Description.
Role: ${role}
Description: ${description}

Your task is to generate an interview plan consisting of 3 parts:
1. General Questions ("Must-haves"): 3 conversational questions about the candidate's past experience with specific technologies or architectures mentioned in the job description.
2. Coding Question: 1 standard Data Structures and Algorithms (DSA) question. IMPORTANT: Pull from standard platforms like LeetCode. Do NOT generate random, long, or convoluted story problems. The question must be short, concise, and easy to parse immediately.
3. System Design Question: 1 classic system design scenario relevant to the role's domain and scale. Again, keep it standard and concise.

You MUST respond with ONLY valid JSON in the following exact structure, with no markdown formatting around it:
{
  "general": [
    {
      "title": "Short title (e.g. React hooks)",
      "question": "The actual full question to ask the candidate."
    }
  ],
  "coding": [
    {
      "title": "Short title (e.g. Two Sum)",
      "question": "The short, standard coding question prompt."
    }
  ],
  "systemDesign": [
    {
      "title": "Short title (e.g. URL Shortener)",
      "question": "The short, standard system design prompt."
    }
  ]
}`

    let lastError = null

    // Try up to keys.length times to find a working key
    for (let attempts = 0; attempts < keys.length; attempts++) {
      const activeKey = keys[currentKeyIndex % keys.length]
      currentKeyIndex = (currentKeyIndex + 1) % keys.length
      
      try {
        const groq = new Groq({ apiKey: activeKey })
        
        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'openai/gpt-oss-120b',
          temperature: 0.2,
          max_tokens: 1024
        })

        const responseContent = chatCompletion.choices[0]?.message?.content
        
        // Clean up potential markdown formatting if the model didn't output raw JSON
        const cleanJson = responseContent.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const parsed = JSON.parse(cleanJson)
        return Response.json(parsed)
      } catch (err) {
        console.warn(`Groq key index ${(currentKeyIndex === 0 ? keys.length : currentKeyIndex) - 1} failed:`, err.message)
        lastError = err
      }
    }

    if (lastError) {
      throw lastError
    }

  } catch (error) {
    console.error('Error in generate-plan:', error.message)
    return Response.json({ error: 'Internal server error: ' + error.message }, { status: 500 })
  }
}
