import { useState } from '@lynx-js/react'

import './App.css'

export function App() {
  const [count, setCount] = useState(0)

  return (
    <view className="app">
      <view className="card">
        <text className="title">Hello, Sparkling ✨</text>
        <text className="subtitle">
          A minimal Lynx page running inside Sparkling.
        </text>

        <view className="counter" bindtap={() => setCount((c) => c + 1)}>
          <text className="counter__label">Tapped</text>
          <text className="counter__value">{count}</text>
          <text className="counter__hint">Tap me</text>
        </view>
      </view>
    </view>
  )
}
