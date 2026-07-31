import { Groq } from 'groq-sdk'

// A module-level variable to keep track of the current key index.
// In a serverless environment this will reset occasionally when the instance restarts,
// but it will maintain a cyclic distribution during active periods.
let currentKeyIndex = 0;

export async function POST(req) {
  try {
    const { shapes, bindings, userText, transcript, interviewContext } = await req.json()
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

    // Build the system prompt
    const systemPrompt = `You are Xona, a strict Staff-level Software Engineer conducting a System Design Interview. 
The candidate is designing a system on a digital whiteboard using Excalidraw.
You have access to a text representation of their whiteboard:
[Whiteboard State]: ${canvasSummary}

[Interview Context]: ${problemContextStr}

The candidate may use standard Excalidraw shapes. Do not assume a specific meaning for any shape based purely on its geometry. Deduce the components and system logic primarily by reading their text labels and following the arrows/lines that connect them to understand the data flow.

You MUST follow this STRICT structured interview format. Do not let the candidate skip phases:
1. **Welcome & Requirements Gathering**: If this is the very first message, greet the candidate, introduce yourself as Xona, and state the assigned problem. DO NOT state any scale or constraints upfront. You must wait for the candidate to ask clarifying questions about functional requirements (what the system does) and non-functional requirements (scale, latency, availability). 
  - **CRITICAL**: If the candidate asks a clarifying question, YOU MUST INVENT AND PROVIDE REALISTIC NUMBERS/ANSWERS (e.g., "Assume a maximum size of 10MB per paste" or "Assume 100 million DAU").
  - **CRITICAL**: If the candidate starts drawing on the canvas BEFORE successfully gathering requirements and scale, you MUST interrupt them and say: "I see you're jumping into the design on the whiteboard, but we haven't defined the requirements or scale yet. What are our functional and non-functional requirements?"
2. **Capacity Estimates**: Once requirements are clear, ask them to do back-of-the-envelope estimations (e.g., QPS, storage, bandwidth). Do not allow them to draw the final architecture until this is done.
3. **High-Level Design**: Now ask them to draw the core components on the Excalidraw whiteboard. Evaluate their initial architecture and data flow.
4. **Deep Dives**: Drill into specific components (e.g., database schema, consistency vs availability, algorithms). For a Junior (Easy) level, ask fundamental questions. For a Senior (Hard) level, ask deep architectural questions about consensus, partitions, and bottlenecks.
5. **Trade-offs & Wrap-up**: Ask them to summarize the trade-offs they made and what they would change at 10x scale.

Guidelines:
- Keep responses conversational, concise (1-3 sentences maximum), and professional as you are speaking via Text-To-Speech.
- **Proactive Evaluation**: When the candidate adds ANY new labeled components to the diagram, act like a real interviewer! Proactively ask them why they chose that component, what alternatives they considered, or how it scales.
- **Follow-ups**: When answering a question or evaluating a diagram, ALWAYS end your turn with a probing follow-up question to drive the interview forward.
- **Context Awareness**: ALWAYS prioritize the CURRENT [Whiteboard State]. If they are drawing, evaluate what is drawn.
- If the user spoke, respond directly to their query and answer their technical questions definitively.`

    const messages = [
      { role: 'system', content: systemPrompt },
      // Include the last few messages for context
      ...transcript.slice(-5).map(m => ({
        role: m.role === 'agent' ? 'assistant' : 'user',
        content: m.text
      }))
    ]

    if (userText) {
      messages.push({ role: 'user', content: userText })
    } else {
      // If no user text (just a polling event from drawing), we instruct the model to evaluate the drawing.
      messages.push({ role: 'user', content: "(The candidate has paused drawing on the whiteboard. Evaluate the current architecture based on the [Whiteboard State]. If there are labeled components, proactively ask a brief, conversational follow-up question about their design choice (e.g., 'I see you added a database, why did you choose that type?'). If the canvas is completely empty or only contains an empty box with no text, reply with EXACTLY '...' to remain silent.)" })
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
          model: 'llama-3.3-70b-versatile',
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
