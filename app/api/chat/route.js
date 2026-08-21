
import { Groq } from 'groq-sdk'

// A module-level variable to keep track of the current key index.
// In a serverless environment this will reset occasionally when the instance restarts,
// but it will maintain a cyclic distribution during active periods.
let currentKeyIndex = 0;

export async function POST(req) {
  try {
    const { shapes, bindings, userText, transcript, interviewContext, language, currentPhase } = await req.json()
    // Retrieve all configured API keys
    const keys = [
      process.env.GROQ_API_KEY_1,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
      process.env.GROQ_API_KEY_4,
      process.env.GROQ_API_KEY_5,
      process.env.GROQ_API_KEY_6
    ].filter(Boolean) // Remove any undefined/empty keys

    if (keys.length === 0) {
      return Response.json({ reply: "I'm sorry, no Groq API keys are configured. Please add them to your .env.local file." })
    }

    // Build a spatial/topological summary of the canvas
    let canvasSummary = 'The canvas is currently empty.'
    
    if (shapes && shapes.length > 0) {
      const shapeMap = {}
      shapes.forEach(s => { shapeMap[s.id] = s })
      
      // Separate shapes
      const standaloneTexts = shapes.filter(s => s.type === 'text')
      const arrows = shapes.filter(s => s.type === 'arrow')
      const nodes = shapes.filter(s => s.type !== 'text' && s.type !== 'arrow')
      
      // Resolve arrow connections from bindings
      arrows.forEach(a => {
        const startBinding = (bindings || []).find(b => b.fromId === a.id && b.terminal === 'start')
        const endBinding = (bindings || []).find(b => b.fromId === a.id && b.terminal === 'end')
        if (startBinding) a.startTargetId = startBinding.toId
        if (endBinding) a.endTargetId = endBinding.toId
        
        // Fallback: Infer connection for unbound arrows
        const findNearestNode = (x, y) => {
          let nearest = null; let minDist = 150;
          nodes.forEach(n => {
            // Compare to center of node (roughly)
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
      
      // Heuristic: Bind free-floating text to nearest node/arrow
      standaloneTexts.forEach(txt => {
        let nearest = null
        let minDist = 300 // Search radius for nodes
        
        // Check nodes
        nodes.forEach(n => {
          let dist = Math.sqrt(Math.pow(txt.x - n.x, 2) + Math.pow(txt.y - n.y, 2))
          if (dist < minDist) { minDist = dist; nearest = n }
        })
        
        // Check arrows (use midpoint if bounded)
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
      
      // If there are only standalone texts without nodes
      if (nodes.length === 0 && arrows.length === 0 && standaloneTexts.length > 0) {
         desc += standaloneTexts.map(t => `- Text: "${t.text}"`).join('\n')
      }
      
      canvasSummary = desc
    }

    let problemContextStr = "The user has not been assigned a specific problem yet."
    if (interviewContext && interviewContext.problem) {
      const pDesc = (interviewContext.problem.description || '').trim()
      if (!pDesc || pDesc === 'Design a scalable system based on the interviewer prompts.') {
         problemContextStr = `The candidate needs to be tested at a ${interviewContext.level} level of experience.
Because no specific problem was assigned, YOU MUST INVENT a specific, classic system design question (e.g., "Design Twitter", "Design a URL Shortener", "Design a Distributed Rate Limiter") appropriate for a ${interviewContext.level} engineer, and explicitly ask them this question in your very first message.`
      } else {
        problemContextStr = `The candidate has been assigned the following problem based on their ${interviewContext.level} level of experience:
Title: ${interviewContext.problem.title}
Description: ${pDesc}
Constraints to focus on: ${interviewContext.problem.constraints}`
      }
    }

    // Extract dynamic questions from the admin plan if available
    const plan = interviewContext?.plan || {}
    const generalQuestions = plan.general && plan.general.length > 0 
      ? plan.general.map((q, i) => `${i+1}. ${q.question}`).join('\n')
      : `Ask 3 to 4 conversational questions to assess their general experience and cultural fit based on a ${interviewContext?.level || 'mid-level'} engineer profile.`
      
    const codingQuestions = plan.coding && plan.coding.length > 0
      ? plan.coding.map(q => `Title: ${q.title}\nDescription: ${q.question}`).join('\n\n')
      : `Provide a standard coding challenge appropriate for a ${interviewContext?.level || 'mid-level'} engineer.`

    const systemDesignQuestions = plan.systemDesign && plan.systemDesign.length > 0
      ? plan.systemDesign.map(q => `Title: ${q.title}\nDescription: ${q.question}`).join('\n\n')
      : `Design a scalable system based on the interviewer prompts.`

    // Determine the instructions based on the current phase
    let phaseInstructions = ''
    if (currentPhase === 'interview') {
      phaseInstructions = `CURRENT PHASE: General Conversation
You are in the conversational interview phase. The candidate cannot see the code editor or whiteboard yet.

STRICT RULES YOU MUST FOLLOW:
1. Start your VERY FIRST response by briefly introducing yourself as Xona, welcome the candidate, and ask the first question.
2. Ask these questions ONE AT A TIME, in this EXACT ORDER:
${generalQuestions}
3. After asking each question, you MUST WAIT for the candidate to respond. DO NOT ask the next question in the same message.
4. After the candidate answers a question, briefly acknowledge their answer, then ask the NEXT question.
5. CRITICAL: After the candidate answers the LAST question, acknowledge their answer. Then ASK FOR PERMISSION: "That covers the conversational round! Are you ready to move on to the coding challenge?"
6. ONLY after the candidate explicitly says "yes" or "ready" or "sure" or similar, say ONLY a very short acknowledgement like "Great, let's go!" and include exactly "[PHASE_CHANGE: coding]" in your response. Keep it to 1 sentence max.
7. DO NOT include "[PHASE_CHANGE: coding]" unless the candidate explicitly agrees to move on.
8. DO NOT present the coding challenge or describe it. Just include [PHASE_CHANGE: coding] and stop. The coding agent will present the question.`
    } else if (currentPhase === 'coding') {
      phaseInstructions = `CURRENT PHASE: Coding Challenge
The candidate now has access to a code editor on their screen.

[Assigned DSA Coding Question]:
${codingQuestions}

STRICT WORKFLOW YOU MUST FOLLOW - DO NOT DEVIATE:
Step 1 (FIRST MESSAGE - CRITICAL): Your VERY FIRST response MUST start with "Welcome to the coding round!" followed IMMEDIATELY by the full coding question. Do NOT delay or ask if they are ready. Present the question right now. End with "Do you have any questions about the problem?"
Step 2 (If they have doubts): Answer their doubts, then say "Go ahead and start coding. Let me know when you're done."
Step 3 (If no doubts): Say "Go ahead and start coding. Let me know when you're done."
Step 4 (After "[CODE_SUBMITTED]:" arrives): NEVER critique the code. Simply say "Thank you for submitting! Are you ready to move on to the system design round?" Include exactly "[PHASE_CHANGE: system_design]" ONLY after they explicitly say yes.

CRITICAL RULES:
- Do NOT tell the candidate if their code is wrong or what the right answer is.
- Do NOT suggest fixes or improvements.
- The assigned question is a DSA question. Do NOT substitute it with any system design problem like URL Shortener.
- Just accept the submission and ask for permission to move on.`
    } else {
      phaseInstructions = `CURRENT PHASE: System Design
The candidate is designing a system on the digital whiteboard (Excalidraw).

[Current Whiteboard State]: ${canvasSummary}

[Assigned System Design Problem]:
${systemDesignQuestions}

STRICT WORKFLOW YOU MUST FOLLOW:
Step 1 (FIRST MESSAGE - CRITICAL): Your VERY FIRST response MUST start with "Welcome to the system design round!" followed IMMEDIATELY by the full system design problem. Do NOT delay or ask if they are ready. Present the problem right now. End with "Do you have any questions before you start designing?"
Step 2 (If they have doubts): Answer doubts with realistic numbers (e.g., "Assume 100 million DAU").
Step 3: Tell the candidate to start designing on the whiteboard. Say "Let me know after completing the design."
Step 4: When the candidate says they are done, say "Great work! That concludes our interview." DO NOT critique the design or tell them what is wrong.
Step 5: While they are designing, you may ask guiding questions about their choices, but NEVER reveal what the correct answer is.

CRITICAL RULES:
- NEVER tell the candidate their design is wrong.
- NEVER reveal what the correct system design is.
- Just guide with questions and accept their submission.`
    }

    // Build the system prompt
    const systemPrompt = `You are Xona, a strict Staff-level Software Engineer conducting a technical interview.

${phaseInstructions}

General Guidelines:
- Keep ALL responses conversational, concise (2-4 sentences maximum), and professional. This is spoken via Text-To-Speech.
- Respond directly and specifically to what the candidate just said.
- **CRITICAL LANGUAGE REQUIREMENT**: You MUST respond exclusively in: ${language || 'English'}.`


    const messages = [
      { role: 'system', content: systemPrompt },
      // Include the last few messages for context
      ...transcript.slice(-6).map(m => ({
        role: m.role === 'agent' ? 'assistant' : 'user',
        content: m.text
      }))
    ]

    if (userText) {
      messages.push({ role: 'user', content: userText })
    } else {
      // If no user text (just a polling event from drawing), we instruct the model to evaluate the drawing.
      if (currentPhase === 'system_design') {
        messages.push({ role: 'user', content: "(The candidate has paused drawing on the whiteboard. Evaluate the current architecture based on the [Whiteboard State]. If there are labeled components, proactively ask a brief, conversational follow-up question about their design choice. If the canvas is completely empty or only contains an empty box with no text, reply with EXACTLY '...' to remain silent.)" })
      } else {
        messages.push({ role: 'user', content: "(The user hasn't said anything. If you are waiting for them, just say '...' to remain silent.)" })
      }
    }

    let lastError = null;

    // Try up to keys.length times to find a working key
    for (let attempts = 0; attempts < keys.length; attempts++) {
      const activeKey = keys[currentKeyIndex % keys.length]
      currentKeyIndex = (currentKeyIndex + 1) % keys.length
      
      try {
        const groq = new Groq({ apiKey: activeKey })
        const stream = await groq.chat.completions.create({
          messages,
          model: 'openai/gpt-oss-120b',
          temperature: 0.5,
          max_tokens: 512,
          stream: true
        })

        const encoder = new TextEncoder()
        const readableStream = new ReadableStream({
          async start(controller) {
            let buffer = ''
            let isFirstChunk = true

            try {
              for await (const chunk of stream) {
                const text = chunk.choices[0]?.delta?.content || ''
                if (text) {
                  buffer += text

                  // Handle the specific 'silent' evaluation case where it just replies "..."
                  if (isFirstChunk && buffer.length >= 3) {
                    if (buffer.trim() === '...') {
                      controller.close()
                      return
                    }
                    isFirstChunk = false
                  }
                  
                  // If we've passed the initial silent check, stream normally
                  if (!isFirstChunk || buffer.length > 3 || (buffer.length > 0 && !'...'.startsWith(buffer))) {
                     controller.enqueue(encoder.encode(text))
                  }
                }
              }
              
              // Edge case: if the total output was literally just "." or ".."
              if (isFirstChunk && buffer.trim() !== '...') {
                 controller.enqueue(encoder.encode(buffer))
              }
              
              controller.close()
            } catch (err) {
              controller.error(err)
            }
          }
        })

        return new Response(readableStream, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        })
      } catch (err) {
        console.warn(`Groq key index ${(currentKeyIndex === 0 ? keys.length : currentKeyIndex) - 1} failed:`, err.message)
        lastError = err
      }
    }

    if (lastError) {
      throw lastError // If all keys failed, throw the last error to be caught by the outer catch block
    }
    
  } catch (error) {
    console.error('Error with Groq API:', error)
    return Response.json({ reply: "I encountered an error while thinking. Let's continue." }, { status: 500 })
  }
}
