import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// GitHub Pages はサブパス（/<repo>/）で配信されるため base を合わせる。
export default defineConfig({
  base: '/vernacular-co-design/',
  plugins: [react()],
})
