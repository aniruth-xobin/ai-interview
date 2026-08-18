import { NextResponse } from 'next/server'
const pdfParse = require('pdf-parse/lib/pdf-parse.js')
import { Groq } from 'groq-sdk'
import fs from 'fs'
import path from 'path'

let currentKeyIndex = 0;

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('resume')
    
    if (!file) {
      return NextResponse.json({ error: 'No resume provided.' }, { status: 400 })
    }

    // Convert file to Buffer for pdf-parse
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Parse PDF text
    let resumeText = ''
    try {
      const pdfData = await pdfParse(buffer)
      resumeText = pdfData.text
    } catch (parseErr) {
      console.error('PDF Parse Error:', parseErr)
      return NextResponse.json({ error: 'Failed to extract text from PDF.' }, { status: 500 })
    }

    // Call Groq to determine candidate level
    const keys = [
      process.env.GROQ_API_KEY_1,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
      process.env.GROQ_API_KEY_4,
      process.env.GROQ_API_KEY_5,
      process.env.GROQ_API_KEY_6
    ].filter(Boolean)

    if (keys.length === 0) {
      return NextResponse.json({ error: 'No API keys configured.' }, { status: 500 })
    }

    const prompt = `
      You are an expert technical recruiter evaluating a Software Engineering candidate's resume.
      Based on the following resume text, classify the candidate's seniority level into exactly one of three categories:
      - "easy": Junior level (0-2 years of experience, internships, recent grad).
      - "medium": Mid level (2-5 years of experience).
      - "hard": Senior/Staff level (5+ years of experience, architectural leadership).
      
      Respond with ONLY ONE WORD: "easy", "medium", or "hard".
      
      Resume Text:
      ${resumeText.substring(0, 3000)} // Limit text to avoid token limits
    `

    let completion
    let level = 'medium'
    let lastError = null

    for (let attempts = 0; attempts < keys.length; attempts++) {
      const activeKey = keys[currentKeyIndex % keys.length]
      currentKeyIndex = (currentKeyIndex + 1) % keys.length
      
      try {
        const groq = new Groq({ apiKey: activeKey })
        completion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'openai/gpt-oss-120b',
          temperature: 0.1,
          max_tokens: 10
        })
        level = completion.choices[0]?.message?.content?.trim().toLowerCase() || 'medium'
        lastError = null
        break
      } catch (err) {
        console.warn(`Groq key index ${(currentKeyIndex === 0 ? keys.length : currentKeyIndex) - 1} failed:`, err.message)
        lastError = err
      }
    }

    if (lastError) {
      throw lastError
    }
    
    // Fallback if the model outputs something weird
    if (!['easy', 'medium', 'hard'].includes(level)) {
      level = 'medium'
    }

    // Load questions.json and select a random question for the determined level
    const questionsPath = path.join(process.cwd(), 'data', 'questions.json')
    const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'))
    
    const levelQuestions = questionsData[level] || questionsData['medium']
    const randomQuestion = levelQuestions[Math.floor(Math.random() * levelQuestions.length)]

    return NextResponse.json({
      level,
      problem: randomQuestion
    })

  } catch (error) {
    console.error('Resume parsing error:', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
