import { useState, useEffect } from 'react'
import styles from '../styles/Home.module.css'

export default function Home() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  // Create preview URL
  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFile = (e) => {
    setFile(e.target.files[0])
    setStatus('idle')
    setMessage('')
  }

  const analyze = async () => {
    if (!file) return
    setStatus('loading')
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const res = await fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: reader.result }),
        })
        const json = await res.json()
        if (res.ok && typeof json.score === 'number') {
          setMessage(json.score.toFixed(4))
          setStatus('done')
        } else {
          setMessage(json.error || 'Unknown error')
          setStatus('error')
        }
      } catch (err) {
        setMessage(err.message)
        setStatus('error')
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>AI-Generated Image Detector</h1>

      {/* 1) Preview */}
      {preview && (
        <img
          src={preview}
          alt="Preview"
          className={styles.preview}
        />
      )}

      {/* 2) Controls */}
      <div className={styles.controls}>
        <label className={styles.uploadLabel}>
          {file ? file.name : 'Choose File'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className={styles.uploadInput}
          />
        </label>
        <button
          className={styles.button}
          onClick={analyze}
          disabled={!file || status === 'loading'}
        >
          {status === 'loading' ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      {/* 3) Info */}
      {status !== 'idle' && (
        <div className={styles.result}>
          <div className={status === 'error' ? styles.error : ''}>
            Score: {message}
          </div>
        </div>
      )}
      <br></br> <strong>
      <div className={styles.info}>AI Score (0 = Real, 1 = Fake)</div></strong>
    </div>
  )
}
