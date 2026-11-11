import { createContext, useContext, useEffect } from 'react'

export const AuthSceneContext = createContext(null)
export function useAuthSceneReaction(trigger, mood = 'sad') {
  const scene = useContext(AuthSceneContext)

  useEffect(() => {
    if (trigger) scene?.react(mood)
  }, [scene, trigger, mood])
}
