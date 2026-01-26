'use client'

import { useState } from 'react'
import Button from './basic/Button'

export default function Counter() {
  const [count, setCount] = useState(0)

  const increment = () => setCount(count + 1)
  const decrement = () => setCount(count - 1)
  const reset = () => setCount(0)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-4xl font-bold text-gray-900 dark:text-white">
        {count}
      </div>
      <div className="flex gap-2">
        <Button onClick={decrement} variant="secondary" size="md">
          -
        </Button>
        <Button onClick={reset} variant="secondary" size="md">
          Reset
        </Button>
        <Button onClick={increment} variant="primary" size="md">
          +
        </Button>
      </div>
    </div>
  )
}
