import {
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/react'
import {
  albumsOutline,
  arrowForwardOutline,
  chatbubbleEllipsesOutline,
  checkmarkCircle,
  codeSlashOutline,
  colorWandOutline,
  documentTextOutline,
  gitCompareOutline,
  imageOutline,
  lockClosedOutline,
  shieldCheckmarkOutline,
  sparkles,
} from 'ionicons/icons'
import { useEffect, useRef, useState } from 'react'
import './LandingPage.css'

interface LandingPageProps {
  authenticating: boolean
  message?: string
  needsRecovery: boolean
  onSignIn: () => void
}

const workflowSteps = [
  {
    name: 'Assistant',
    icon: chatbubbleEllipsesOutline,
    title: 'Keep the conversation moving.',
    description: 'Work through durable, streamed conversations with images, files, and saved prompts close at hand.',
  },
  {
    name: 'Model lab',
    icon: gitCompareOutline,
    title: 'Compare before you commit.',
    description: 'Run one prompt across available providers and inspect the responses in a shared frame.',
  },
  {
    name: 'Image lab',
    icon: imageOutline,
    title: 'Move from prompt to visual.',
    description: 'Generate or edit images while keeping source material and model state visible.',
  },
  {
    name: 'Prompts',
    icon: albumsOutline,
    title: 'Make good prompts reusable.',
    description: 'Save, filter, and return to the instructions that deserve a place in your workflow.',
  },
  {
    name: 'Converter',
    icon: codeSlashOutline,
    title: 'Turn workbooks into clean data.',
    description: 'Convert local spreadsheets to JSON in the browser, then preview the result before download.',
  },
] as const

function MicrosoftMark() {
  return (
    <span className="microsoft-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  )
}

function AssistantScene() {
  return (
    <div className="mock-scene mock-assistant">
      <div className="mock-page-heading">
        <div>
          <strong>Assistant</strong>
          <span>Continue a private workspace conversation.</span>
        </div>
        <span className="mock-status"><i /> Ready</span>
      </div>
      <div className="mock-transcript">
        <div className="mock-message mock-message-user">
          <span>You</span>
          Compare three ways to explain this launch plan.
        </div>
        <div className="mock-message mock-message-assistant">
          <span>Prism</span>
          <p>I’ll separate the options by audience, tradeoff, and the decision each version supports.</p>
          <div className="mock-answer-lines" aria-hidden="true"><i /><i /><i /></div>
        </div>
      </div>
      <div className="mock-composer">
        <span>Ask a follow-up…</span>
        <button type="button" tabIndex={-1} aria-hidden="true"><IonIcon icon={arrowForwardOutline} /></button>
      </div>
    </div>
  )
}

function ModelLabScene() {
  return (
    <div className="mock-scene mock-model-lab">
      <div className="mock-page-heading">
        <div>
          <strong>Model lab</strong>
          <span>One prompt, side-by-side responses.</span>
        </div>
        <span className="mock-status"><i /> Availability checked</span>
      </div>
      <div className="mock-prompt-bar">
        <span>Explain the tradeoffs in plain language.</span>
        <b>Run comparison</b>
      </div>
      <div className="mock-model-grid">
        <article>
          <header><span>Provider A</span><small>Available</small></header>
          <div className="mock-answer-lines" aria-hidden="true"><i /><i /><i /><i /></div>
          <footer>Response complete</footer>
        </article>
        <article>
          <header><span>Provider B</span><small>Available</small></header>
          <div className="mock-answer-lines" aria-hidden="true"><i /><i /><i /></div>
          <footer>Response complete</footer>
        </article>
      </div>
      <div className="mock-analysis">
        <IonIcon icon={sparkles} />
        <span><strong>Cross-model analysis</strong> Shared themes and meaningful differences stay in view.</span>
      </div>
    </div>
  )
}

function ImageLabScene() {
  return (
    <div className="mock-scene mock-image-lab">
      <div className="mock-page-heading">
        <div>
          <strong>Image lab</strong>
          <span>Generate and edit in one visual workspace.</span>
        </div>
        <span className="mock-status"><i /> Ready</span>
      </div>
      <div className="mock-image-prompt">
        <span>A quiet graphite workbench lit by refracted violet light</span>
        <b>Generate</b>
      </div>
      <div className="mock-image-grid">
        <div className="mock-generated-image mock-generated-image-a"><i /><i /><i /></div>
        <div className="mock-generated-image mock-generated-image-b"><i /><i /><i /></div>
      </div>
      <div className="mock-image-meta"><span>Illustrative previews</span><span>Source image optional</span></div>
    </div>
  )
}

function PromptScene() {
  const prompts = [
    ['Launch review', 'Strategy', 'Compare an announcement against its audience and desired action.'],
    ['Refactor checklist', 'Engineering', 'Review a change for correctness, clarity, and recovery paths.'],
    ['Image direction', 'Creative', 'Translate a visual goal into material, composition, and light.'],
  ] as const

  return (
    <div className="mock-scene mock-prompts">
      <div className="mock-page-heading">
        <div>
          <strong>Prompt library</strong>
          <span>Reusable instructions, ready when the work repeats.</span>
        </div>
        <span className="mock-add-button">New prompt</span>
      </div>
      <div className="mock-filter-bar"><span>Search prompts</span><span>All categories</span></div>
      <div className="mock-prompt-list">
        {prompts.map(([title, category, body]) => (
          <article key={title}>
            <div><strong>{title}</strong><p>{body}</p></div>
            <span>{category}</span>
          </article>
        ))}
      </div>
    </div>
  )
}

function ConverterScene() {
  return (
    <div className="mock-scene mock-converter">
      <div className="mock-page-heading">
        <div>
          <strong>Workbook converter</strong>
          <span>Local spreadsheet in. Structured JSON out.</span>
        </div>
        <span className="mock-status"><i /> Browser only</span>
      </div>
      <div className="mock-convert-flow">
        <div className="mock-dropzone">
          <IonIcon icon={documentTextOutline} />
          <strong>quarterly-plan.xlsx</strong>
          <span>Workbook ready to convert</span>
        </div>
        <IonIcon className="mock-flow-arrow" icon={arrowForwardOutline} />
        <div className="mock-json">
          <span>{'{'}</span>
          <code>&quot;sheet&quot;: &quot;Plan&quot;,</code>
          <code>&quot;rows&quot;: [ … ]</code>
          <span>{'}'}</span>
        </div>
      </div>
      <div className="mock-convert-footer"><span>Preview before download</span><b>Download JSON</b></div>
    </div>
  )
}

function SceneCanvas({ scene }: { scene: number }) {
  switch (scene) {
    case 1: return <ModelLabScene />
    case 2: return <ImageLabScene />
    case 3: return <PromptScene />
    case 4: return <ConverterScene />
    default: return <AssistantScene />
  }
}

function WorkspaceMockup({ scene, compact = false }: { compact?: boolean, scene: number }) {
  return (
    <div className={`workspace-mockup${compact ? ' workspace-mockup-compact' : ''}`}>
      <div className="mock-window-bar">
        <div className="mock-traffic" aria-hidden="true"><i /><i /><i /></div>
        <div className="mock-window-title">
          <img src="/apple-touch-icon.png" alt="" />
          <span>Prism</span>
        </div>
        <span className="mock-demo-label">Illustrative workspace</span>
      </div>
      <div className="mock-app-body">
        <aside className="mock-sidebar" aria-label="Illustrative navigation">
          <div className="mock-sidebar-brand">
            <img src="/apple-touch-icon.png" alt="" />
            <div><strong>Prism</strong><span>AI workbench</span></div>
          </div>
          <div className="mock-sidebar-nav">
            {workflowSteps.map((step, index) => (
              <div className={index === scene ? 'active' : ''} key={step.name}>
                <IonIcon icon={step.icon} />
                <span>{step.name}</span>
              </div>
            ))}
          </div>
          <div className="mock-authority"><IonIcon icon={shieldCheckmarkOutline} /> Local authority</div>
        </aside>
        <div className="mock-canvas" key={scene}>
          <SceneCanvas scene={scene} />
        </div>
      </div>
    </div>
  )
}

export function LandingPage({
  authenticating,
  message,
  needsRecovery,
  onSignIn,
}: LandingPageProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [activeScene, setActiveScene] = useState(0)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let scrollY = root.scrollTop
    let pointerX = 0
    let pointerY = 0
    let frame = 0

    const draw = () => {
      frame = 0
      if (reducedMotion.matches) return

      root.style.setProperty('--pointer-x', `${pointerX * 12}px`)
      root.style.setProperty('--pointer-x-inverse', `${pointerX * -9}px`)
      root.style.setProperty('--pointer-x-soft', `${pointerX * 6}px`)
      root.style.setProperty('--pointer-x-soft-inverse', `${pointerX * -6}px`)
      root.style.setProperty('--pointer-y', `${pointerY * 10}px`)
      root.style.setProperty('--tilt-x', `${pointerY * -1.6}deg`)
      root.style.setProperty('--tilt-y', `${pointerX * 2.2}deg`)
      root.querySelectorAll<HTMLElement>('[data-parallax]').forEach((element) => {
        const rate = Number(element.dataset.parallax ?? 0)
        element.style.setProperty('--parallax-y', `${Math.min(scrollY, 1600) * rate}px`)
      })
    }

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(draw)
    }
    const onScroll = () => {
      scrollY = root.scrollTop
      schedule()
    }
    const onPointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth) * 2 - 1
      pointerY = (event.clientY / window.innerHeight) * 2 - 1
      schedule()
    }
    const onMotionChange = () => {
      if (reducedMotion.matches) {
        root.style.removeProperty('--pointer-x')
        root.style.removeProperty('--pointer-x-inverse')
        root.style.removeProperty('--pointer-x-soft')
        root.style.removeProperty('--pointer-x-soft-inverse')
        root.style.removeProperty('--pointer-y')
        root.style.removeProperty('--tilt-x')
        root.style.removeProperty('--tilt-y')
        root.querySelectorAll<HTMLElement>('[data-parallax]').forEach((element) => {
          element.style.removeProperty('--parallax-y')
        })
      }
      schedule()
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    reducedMotion.addEventListener('change', onMotionChange)
    schedule()

    return () => {
      root.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onPointerMove)
      reducedMotion.removeEventListener('change', onMotionChange)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const index = Number((visible.target as HTMLElement).dataset.scene)
        if (Number.isInteger(index)) setActiveScene(index)
      },
      { rootMargin: '-34% 0px -42%', threshold: [0.2, 0.5, 0.8] },
    )

    stepRefs.current.forEach((element) => {
      if (element) observer.observe(element)
    })
    return () => observer.disconnect()
  }, [])

  const actionLabel = needsRecovery ? 'Refresh with Microsoft' : 'Continue with Microsoft'

  return (
    <div className="landing" ref={rootRef}>
      <a className="skip-link" href="#landing-main">Skip to main content</a>
      <div className="landing-atmosphere" aria-hidden="true">
        <span className="landing-orb landing-orb-violet" data-parallax="-0.035" />
        <span className="landing-orb landing-orb-cyan" data-parallax="-0.06" />
        <span className="landing-orb landing-orb-pink" data-parallax="-0.025" />
        <span className="landing-grain" />
      </div>

      <header className="landing-nav">
        <a className="landing-brand" href="#landing-top" aria-label="Prism home">
          <img src="/apple-touch-icon.png" alt="" />
          <span><strong>Prism</strong><small>AI workbench</small></span>
        </a>
        <nav className="landing-nav-links" aria-label="Landing page">
          <a href="#workspace">Workspace</a>
          <a href="#principles">Principles</a>
        </nav>
        <IonButton
          className="landing-nav-action"
          disabled={authenticating}
          fill="clear"
          onClick={onSignIn}
        >
          {authenticating ? <IonSpinner name="crescent" /> : <MicrosoftMark />}
          <span className="landing-nav-label">{needsRecovery ? 'Refresh session' : 'Sign in'}</span>
        </IonButton>
      </header>

      <main id="landing-main">
        <section className="landing-hero" id="landing-top">
          <div className="landing-hero-copy">
            <h1>AI work, refracted into one clear workspace.</h1>
            <p>
              Write with an assistant, compare model responses, shape imagery, reuse prompts,
              and convert workbooks without scattering the work across tools.
            </p>
            <div className="landing-hero-actions">
              <IonButton
                className="landing-primary-action"
                disabled={authenticating}
                onClick={onSignIn}
              >
                {authenticating ? <IonSpinner name="crescent" /> : <MicrosoftMark />}
                <span>{authenticating ? 'Opening Microsoft…' : actionLabel}</span>
                {!authenticating && <IonIcon icon={arrowForwardOutline} />}
              </IonButton>
              <a className="landing-text-link" href="#workspace">See the workspace <IonIcon icon={arrowForwardOutline} /></a>
            </div>
            <p className="landing-auth-note">
              <IonIcon icon={lockClosedOutline} />
              Conversations, prompts, and provider access stay inside your Prism identity boundary.
            </p>
            {needsRecovery && (
              <div className="landing-recovery" role="status">
                <IonIcon icon={shieldCheckmarkOutline} />
                <div><strong>Session refresh required</strong><span>{message}</span></div>
              </div>
            )}
          </div>

          <div className="landing-hero-stage" aria-label="Illustrative Prism workspace">
            <div className="hero-spectrum" data-parallax="-0.03" aria-hidden="true" />
            <div className="hero-fold hero-fold-models" data-parallax="-0.055" aria-hidden="true">
              <span>Model lab</span>
              <div><i /><i /><i /></div>
            </div>
            <div className="hero-fold hero-fold-prompts" data-parallax="-0.025" aria-hidden="true">
              <span>Prompt library</span>
              <div><i /><i /><i /><i /></div>
            </div>
            <div className="hero-workspace-plane" data-parallax="-0.018">
              <WorkspaceMockup compact scene={0} />
            </div>
            <div className="hero-float-label hero-float-private" data-parallax="-0.075">
              <IonIcon icon={shieldCheckmarkOutline} /> Identity boundary
            </div>
            <div className="hero-float-label hero-float-ready" data-parallax="-0.045">
              <IonIcon icon={checkmarkCircle} /> Workspace ready
            </div>
          </div>

          <div className="landing-proof-line" aria-label="Prism capabilities">
            <span>Durable conversations</span>
            <span>Cross-provider comparison</span>
            <span>Confirmed media actions</span>
            <span>Browser-only conversion</span>
          </div>
        </section>

        <section className="workflow-showcase" id="workspace">
          <div className="landing-section-heading">
            <h2>One workbench. Five focused configurations.</h2>
            <p>The frame stays familiar while the working surface changes around the task.</p>
          </div>
          <div className="workflow-layout">
            <div className="workflow-steps">
              {workflowSteps.map((step, index) => (
                <button
                  aria-pressed={activeScene === index}
                  className={activeScene === index ? 'active' : ''}
                  data-scene={index}
                  key={step.name}
                  onClick={() => setActiveScene(index)}
                  ref={(element) => { stepRefs.current[index] = element }}
                  type="button"
                >
                  <span className="workflow-step-icon"><IonIcon icon={step.icon} /></span>
                  <span className="workflow-step-copy">
                    <small>{step.name}</small>
                    <strong>{step.title}</strong>
                    <span>{step.description}</span>
                  </span>
                  <IonIcon className="workflow-step-arrow" icon={arrowForwardOutline} />
                </button>
              ))}
            </div>
            <div className="workflow-stage">
              <div className="workflow-stage-glow" aria-hidden="true" />
              <WorkspaceMockup scene={activeScene} />
            </div>
          </div>
        </section>

        <section className="principles-section" id="principles">
          <div className="landing-section-heading">
            <h2>Clarity carries through the whole system.</h2>
            <p>Prism makes state and consequences visible before the next action.</p>
          </div>
          <dl className="principles-grid">
            <div>
              <dt><IonIcon icon={documentTextOutline} /> Keep private work durable</dt>
              <dd>Conversation and prompt workflows remain recoverable inside the same identity-aware workspace.</dd>
            </div>
            <div>
              <dt><IonIcon icon={colorWandOutline} /> Make capability explicit</dt>
              <dd>Provider availability is shown as state, so an unavailable model never looks like a broken action.</dd>
            </div>
            <div>
              <dt><IonIcon icon={shieldCheckmarkOutline} /> Confirm external changes</dt>
              <dd>Media actions expose an exact preview and confirmation step before anything is committed.</dd>
            </div>
          </dl>
        </section>

        <section className="landing-close">
          <div>
            <img src="/apple-touch-icon.png" alt="" />
            <div><h2>Bring the next prompt into focus.</h2><p>Open the private workbench with your Microsoft identity.</p></div>
          </div>
          <IonButton
            className="landing-primary-action"
            disabled={authenticating}
            onClick={onSignIn}
          >
            {authenticating ? <IonSpinner name="crescent" /> : <MicrosoftMark />}
            <span>{authenticating ? 'Opening Microsoft…' : actionLabel}</span>
            {!authenticating && <IonIcon icon={arrowForwardOutline} />}
          </IonButton>
        </section>
      </main>

      <footer className="landing-footer">
        <span>Prism</span>
        <span>Private AI workbench</span>
      </footer>
    </div>
  )
}
