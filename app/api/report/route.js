export const runtime = 'edge';\n
import { Groq } from 'groq-sdk'

let currentKeyIndex = 0;

export async function POST(req) {
  try {
  const { shapes, bindings, rawElements, transcript, interviewContext, submittedCode } = await req.json()
    
    const keys = [
      process.env.GROQ_API_KEY_1,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
      process.env.GROQ_API_KEY_4,
      process.env.GROQ_API_KEY_5,
      process.env.GROQ_API_KEY_6
    ].filter(Boolean)

    if (keys.length === 0) {
      return Response.json({ error: "No API keys configured." }, { status: 500 })
    }

    // Build a spatial/topological summary of the canvas
    let canvasSummary = 'The canvas is currently empty.'
    
    // Use rawElements (native Excalidraw format) if available, otherwise fall back to simplified shapes
    const effectiveShapes = (rawElements && rawElements.length > 0) ? rawElements : shapes;
    
    if (effectiveShapes && effectiveShapes.length > 0) {
      const shapeMap = {}
      effectiveShapes.forEach(s => { shapeMap[s.id] = s })
      
      const standaloneTexts = effectiveShapes.filter(s => s.type === 'text' && !s.isDeleted)
      const arrows = effectiveShapes.filter(s => s.type === 'arrow' && !s.isDeleted)
      const nodes = effectiveShapes.filter(s => !['text', 'arrow', 'freedraw'].includes(s.type) && !s.isDeleted)
      
      arrows.forEach(a => {
        const startBinding = (bindings || []).find(b => b.fromId === a.id && b.terminal === 'start')
        const endBinding = (bindings || []).find(b => b.fromId === a.id && b.terminal === 'end')
        if (startBinding) a.startTargetId = startBinding.toId
        if (endBinding) a.endTargetId = endBinding.toId
        
        const findNearestNode = (x, y) => {
          let nearest = null; let minDist = 150;
          nodes.forEach(n => {
            let nx = n.x + (n.w / 2)
            let ny = n.y + (n.h / 2)
            let dist = Math.sqrt(Math.pow(x - nx, 2) + Math.pow(y - ny, 2))
            if (dist < minDist) { minDist = dist; nearest = n.id }
          })
          return nearest
        }
        
        if (!a.startTargetId) a.startTargetId = findNearestNode(a.x + (a.startX || 0), a.y + (a.startY || 0))
        if (!a.endTargetId) a.endTargetId = findNearestNode(a.x + (a.endX || 0), a.y + (a.endY || 0))
      })
      
      standaloneTexts.forEach(txt => {
        let nearest = null
        let minDist = 300 
        
        nodes.forEach(n => {
          let dist = Math.sqrt(Math.pow(txt.x - n.x, 2) + Math.pow(txt.y - n.y, 2))
          if (dist < minDist) { minDist = dist; nearest = n }
        })
        
        arrows.forEach(a => {
          let ax = a.x
          let ay = a.y
          
          let startNode = shapeMap[a.startTargetId]
          let endNode = shapeMap[a.endTargetId]
          if (startNode && endNode) {
             ax = (startNode.x + endNode.x) / 2
             ay = (startNode.y + endNode.y) / 2
          }
          
          let dist = Math.sqrt(Math.pow(txt.x - ax, 2) + Math.pow(txt.y - ay, 2))
          if (dist < minDist && dist < 200) { minDist = dist; nearest = a }
        })
        
        if (nearest) {
          nearest.nearbyText = nearest.nearbyText ? nearest.nearbyText + " " + txt.text : txt.text
        }
      })
      
      let desc = "Architecture Topology:\n"
      
      nodes.forEach(n => {
        let label = n.text ? n.text : (n.nearbyText || `Unnamed ${n.type}`)
        desc += `- Node (${n.id}): [${label}] at (x:${n.x}, y:${n.y})\n`
      })
      
      arrows.forEach(a => {
        let label = a.text ? a.text : (a.nearbyText || `Arrow`)
        let startNode = shapeMap[a.startTargetId]
        let endNode = shapeMap[a.endTargetId]
        
        let startStr = startNode ? (startNode.text || startNode.nearbyText || startNode.id) : "Unknown origin"
        let endStr = endNode ? (endNode.text || endNode.nearbyText || endNode.id) : "Unknown destination"
        
        desc += `- Connection: [${label}] flows from [${startStr}] to [${endStr}]\n`
      })
      
      if (nodes.length === 0 && arrows.length === 0 && standaloneTexts.length > 0) {
         desc += standaloneTexts.map(t => `- Text: "${t.text}"`).join('\n')
      }
      
      canvasSummary = desc
    }

    const systemPrompt = `You are an expert Staff-level Software Engineer grading a candidate's Multi-Phase Technical Interview.
You have access to their assigned problem, their final whiteboard state (System Design), their submitted code (Coding Phase), and the entire conversation transcript.

[Assigned Problem & Context]:
Role: ${interviewContext?.problem?.title || 'System Design'}
Description: ${interviewContext?.problem?.description || ''}
Constraints: ${interviewContext?.problem?.constraints || ''}

[Interview Plan]:
General Questions: ${interviewContext?.plan?.general ? interviewContext.plan.general.map(q => q.question).join(' | ') : 'N/A'}
Coding Problem: ${interviewContext?.plan?.coding ? interviewContext.plan.coding.map(q => q.question).join(' | ') : 'N/A'}
System Design Problem: ${interviewContext?.plan?.systemDesign ? interviewContext.plan.systemDesign.map(q => q.question).join(' | ') : 'N/A'}

[Expected Seniority Level]:
${interviewContext?.level || 'medium'}

[Submitted Code]:
\`\`\`
${submittedCode || 'No code was submitted.'}
\`\`\`

[Final Whiteboard State]:
${canvasSummary}

[Conversation Transcript]:
${transcript.map(m => `${m.role === 'agent' ? 'Interviewer' : 'Candidate'}: ${m.text}`).join('\n')}

Based on the whiteboard design, the submitted code, and the candidate's responses in the chat, evaluate their performance against the [Expected Seniority Level]. A Junior (easy) should be graded more leniently than a Senior (hard).

CRITICAL GRADING RUBRIC:
You must grade the candidate on their performance across all three phases based on the [Interview Plan] provided above:
1. **General Conversation**: Did they answer the behavioral/experience questions well?
2. **Coding Phase**: Was the submitted code syntactically correct, logical, and optimal for the assigned Coding Problem?
3. **System Design Phase**: Did they draw a sound architecture and gather requirements for the assigned System Design Problem?

**PENALTY**: If the candidate submitted completely invalid code or skipped drawing an architecture, reflect this heavily in the score.

You MUST output a valid JSON object matching the following structure exactly. Do NOT wrap the JSON in Markdown (like \`\`\`json). Just return the raw JSON object.

{
  "score": 8.5,
  "level": "L5 (Senior)",
  "decision": "Hire",
  "strengths": [
    "Identified the bottleneck in database writes.",
    "Used message queues appropriately for async processing."
  ],
  "weaknesses": [
    "Forgot to discuss caching strategies for reads.",
    "Skipped requirement gathering and started drawing immediately."
  ],
  "recommendation": "The candidate should focus heavily on defining constraints (DAU, RPS) before jumping into solutions.",
  "feedback": "Overall, a very strong performance, but lacked initial structuring..."
}`

    let completion
    let reportData = null
    let lastError = null

    for (let attempts = 0; attempts < keys.length; attempts++) {
      const activeKey = keys[currentKeyIndex % keys.length]
      currentKeyIndex = (currentKeyIndex + 1) % keys.length
      
      try {
        const groq = new Groq({ apiKey: activeKey })
        completion = await groq.chat.completions.create({
          messages: [{ role: 'system', content: systemPrompt }],
          model: 'openai/gpt-oss-120b',
          temperature: 0.2, 
          response_format: { type: "json_object" },
          max_tokens: 1000
        })
        
        const content = completion.choices[0]?.message?.content
        if (content) {
          reportData = JSON.parse(content)
          break
        }
      } catch (err) {
        console.warn(`Groq key index ${(currentKeyIndex === 0 ? keys.length : currentKeyIndex) - 1} failed:`, err.message)
        lastError = err
      }
    }

    if (!reportData) {
      throw lastError || new Error("Failed to generate report")
    }

    return Response.json(reportData)
    
  } catch (error) {
    console.error('Error generating report:', error)
    return Response.json({ error: "Failed to generate report." }, { status: 500 })
  }
}
