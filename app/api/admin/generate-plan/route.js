export const runtime = 'edge';

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

Your task is to generate a conversational interview plan consisting of exactly 3 questions.
These should be 3 conversational questions about the candidate's past experience with specific technologies or architectures mentioned in the job description. Do NOT include coding or system design questions.

You MUST respond with ONLY valid JSON in the following exact structure, with no markdown formatting around it:
{
  "general": [
    {
      "title": "Short title (e.g. React hooks)",
      "question": "The actual full question to ask the candidate."
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
          model: 'openai/gpt-oss-120b', // Using Llama3 70B for fast JSON generation
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


