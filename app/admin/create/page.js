'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './page.module.css'
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Code, Quote, RefreshCw, GripVertical, Plus, Pencil, Check, X } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

const Editor = ({ content, onChange }) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: styles.editorContent,
      },
    }
  })

  if (!editor) return null

  return (
    <div className={styles.editorContainer}>
      <div className={styles.editorToolbar}>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`${styles.toolbarBtn} ${editor.isActive('bold') ? styles.active : ''}`}><Bold size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`${styles.toolbarBtn} ${editor.isActive('italic') ? styles.active : ''}`}><Italic size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`${styles.toolbarBtn} ${editor.isActive('strike') ? styles.active : ''}`}><Strikethrough size={16} /></button>
        <div className={styles.toolbarDivider}></div>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`${styles.toolbarBtn} ${editor.isActive('heading', { level: 1 }) ? styles.active : ''}`}>H1</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${styles.toolbarBtn} ${editor.isActive('heading', { level: 2 }) ? styles.active : ''}`}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`${styles.toolbarBtn} ${editor.isActive('heading', { level: 3 }) ? styles.active : ''}`}>H3</button>
        <div className={styles.toolbarDivider}></div>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`${styles.toolbarBtn} ${editor.isActive('bulletList') ? styles.active : ''}`}><List size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`${styles.toolbarBtn} ${editor.isActive('orderedList') ? styles.active : ''}`}><ListOrdered size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`${styles.toolbarBtn} ${editor.isActive('blockquote') ? styles.active : ''}`}><Quote size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`${styles.toolbarBtn} ${editor.isActive('codeBlock') ? styles.active : ''}`}><Code size={16} /></button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

export default function AdminWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  
  // Form State
  const [role, setRole] = useState('')
  const [jobDescription, setJobDescription] = useState('<p>We are looking for a great engineer...</p>')
  
  const [interviewPlan, setInterviewPlan] = useState({
    general: [],
    coding: [],
    systemDesign: []
  })
  const [isGenerating, setIsGenerating] = useState(false)
  
  const [language, setLanguage] = useState('English')
  const [voice, setVoice] = useState('en_US-lessac-medium')
  
  const [durationMin, setDurationMin] = useState(45)
  const [level, setLevel] = useState('medium')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '' })
  
  // Editing State
  const [editingCard, setEditingCard] = useState(null) // { type: 'general', index: 0 }
  const [editTitle, setEditTitle] = useState('')
  const [editQuestion, setEditQuestion] = useState('')

  const showAlert = (message) => setAlertConfig({ isOpen: true, message })
  const closeAlert = () => setAlertConfig({ isOpen: false, message: '' })

  const steps = [
    { id: 1, name: 'Job Description' },
    { id: 2, name: 'Interview Plan' },
    { id: 3, name: 'Interview Avatar' },
    { id: 4, name: 'Interview Settings' }
  ]

  const handleGeneratePlan = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/admin/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, description: jobDescription })
      })
      const data = await res.json()
      if (data && data.general) {
        setInterviewPlan(data)
      } else {
        showAlert('Failed to generate plan.')
      }
    } catch (e) {
      console.error(e)
      showAlert('Error generating plan')
    }
    setIsGenerating(false)
  }

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!role.trim()) {
        showAlert('Please enter a job role')
        return
      }
      setCurrentStep(2)
      if (interviewPlan.general.length === 0) {
        handleGeneratePlan()
      }
    } else if (currentStep < 4) {
      setCurrentStep(curr => curr + 1)
    } else {
      // Submit
      setIsSubmitting(true)
      const { data, error } = await supabase
        .from('InterviewLink')
        .insert([{ 
          id: crypto.randomUUID(), 
          title: role, 
          level, 
          durationMin, 
          jobDescription,
          interviewPlan,
          language,
          voice
        }])
        .select()

      if (error) {
        console.error('Error creating link:', error)
        showAlert('Failed to create link')
        setIsSubmitting(false)
      } else {
        if (data && data[0]) {
          router.push(`/admin/link/${data[0].id}`)
        }
      }
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(curr => curr - 1)
  }

  const startEditing = (item, type, index) => {
    setEditingCard({ type, index })
    setEditTitle(item.title)
    setEditQuestion(item.question)
  }

  const saveEdit = (type, index) => {
    const newPlan = { ...interviewPlan }
    newPlan[type][index] = { title: editTitle, question: editQuestion }
    setInterviewPlan(newPlan)
    setEditingCard(null)
  }

  const cancelEdit = () => {
    setEditingCard(null)
  }

  const renderCard = (item, type, index) => {
    const isEditing = editingCard && editingCard.type === type && editingCard.index === index;
    
    if (isEditing) {
      return (
        <div className={styles.card} key={`${type}-${index}`}>
          <div className={styles.cardHeader} style={{ marginBottom: '8px' }}>
            <input 
              className={styles.input} 
              value={editTitle} 
              onChange={e => setEditTitle(e.target.value)} 
              style={{ width: '100%', padding: '8px', fontSize: '15px', fontWeight: '600' }}
            />
          </div>
          <div className={styles.cardContent}>
            <textarea 
              className={styles.input} 
              value={editQuestion} 
              onChange={e => setEditQuestion(e.target.value)} 
              rows={3}
              style={{ width: '100%', padding: '8px', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
            <button onClick={cancelEdit} className={styles.btnSecondary} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <X size={14} /> Cancel
            </button>
            <button onClick={() => saveEdit(type, index)} className={styles.btnPrimary} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={14} /> Save
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className={styles.card} key={`${type}-${index}`}>
        <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GripVertical size={16} className={styles.dragHandle} />
            {item.title}
          </div>
          <button 
            onClick={() => startEditing(item, type, index)}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Edit Question"
          >
            <Pencil size={14} />
          </button>
        </div>
        <div className={styles.cardContent}>
          {item.question}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header / Stepper */}
      <header className={styles.header}>
        <img src="https://xobin.com/wp-content/uploads/2026/04/logo-CQAmVy86.png" alt="Xobin" className={styles.logo} />
        
        <div className={styles.stepper}>
          {steps.map((step, idx) => (
            <div key={step.id} className={`${styles.step} ${currentStep === step.id ? styles.active : ''} ${currentStep > step.id ? styles.completed : ''}`}>
              <div className={styles.stepCircle}>
                {currentStep > step.id ? '✓' : step.id}
              </div>
              {step.name}
              {idx < steps.length - 1 && <div className={styles.stepLine}></div>}
            </div>
          ))}
        </div>

        <div className={styles.headerActions}>
          <button onClick={handlePrev} disabled={currentStep === 1 || isSubmitting} className={styles.btnSecondary}>
            &lt; Previous
          </button>
          <button onClick={handleNext} disabled={isSubmitting || isGenerating} className={styles.btnPrimary}>
            {currentStep === 4 ? (isSubmitting ? 'Creating...' : 'Create Link') : 'Next >'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.content}>
        {currentStep === 1 && (
          <div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Job role</label>
              <input 
                className={styles.input}
                placeholder="Software Engineer (Full Stack)"
                value={role}
                onChange={e => setRole(e.target.value)}
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Job description
              </label>
              <Editor content={jobDescription} onChange={setJobDescription} />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
               <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Must-haves</h3>
               <button type="button" onClick={handleGeneratePlan} disabled={isGenerating} className={styles.regenerateBtn}>
                <RefreshCw size={14} className={isGenerating ? 'spin' : ''} /> 
                {isGenerating ? 'Generating...' : 'Regenerate'}
              </button>
            </div>
            
            {isGenerating ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                Generating interview questions using AI...
              </div>
            ) : (
              <>
                {interviewPlan.general.map((item, i) => renderCard(item, 'general', i))}
                <button className={styles.addBtn}><Plus size={14} /> Add</button>

                <h3 className={styles.sectionTitle} style={{ marginTop: '32px' }}>Coding Question</h3>
                {interviewPlan.coding.map((item, i) => renderCard(item, 'coding', i))}

                <h3 className={styles.sectionTitle} style={{ marginTop: '32px' }}>System Design</h3>
                {interviewPlan.systemDesign.map((item, i) => renderCard(item, 'sd', i))}
              </>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h3 className={styles.sectionTitle}>Voice and accent</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Configure the voice and accent for the AI interviewer.</p>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>Language</label>
              <select className={styles.select} value={language} onChange={e => {
                  setLanguage(e.target.value);
                  setVoice(e.target.value === 'English' ? 'en_US-lessac-medium' : 'hi_IN-priyamvada-medium');
              }}>
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Interview accent</label>
              <select className={styles.select} value={voice} onChange={e => setVoice(e.target.value)}>
                {language === 'English' ? (
                  <>
                    <option value="en_US-lessac-medium">English (US Accent - Lessac)</option>
                  </>
                ) : (
                  <>
                    <option value="hi_IN-priyamvada-medium">Hindi (Priyamvada)</option>
                  </>
                )}
              </select>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <h3 className={styles.sectionTitle}>Interview Settings</h3>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>Seniority Level</label>
              <select className={styles.select} value={level} onChange={e => setLevel(e.target.value)}>
                <option value="easy">Junior (Easy)</option>
                <option value="medium">Mid-Level (Medium)</option>
                <option value="hard">Senior (Hard)</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Duration (Minutes)</label>
              <input 
                type="number"
                className={styles.input}
                min="5" 
                max="180" 
                value={durationMin}
                onChange={e => {
                  const val = parseInt(e.target.value)
                  setDurationMin(isNaN(val) ? '' : val)
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* Custom Alert Modal */}
      {alertConfig.isOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
               {/* Favicon / Logo SVG embedded for the popup */}
               <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.9997 0C8.95383 0 0 8.95408 0 20C0 31.0459 8.95383 40 19.9997 40C31.0457 40 40 31.0459 40 20C40 8.95408 31.0457 0 19.9997 0ZM30.4357 28.536L28.5361 30.4356L19.9997 21.8993L11.4634 30.4356L9.56372 28.536L18.1001 19.9997L9.56372 11.4633L11.4634 9.56366L19.9997 18.1L28.5361 9.56366L30.4357 11.4633L21.8994 19.9997L30.4357 28.536Z" fill="#0284c7"/>
               </svg>
            </div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#111827', textAlign: 'center' }}>Notification</h4>
            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#4b5563', textAlign: 'center' }}>{alertConfig.message}</p>
            <button onClick={closeAlert} className={styles.btnPrimary} style={{ width: '100%', padding: '10px' }}>
              OK
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  )
}
