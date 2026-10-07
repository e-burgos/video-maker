import { createRoot } from 'react-dom/client';
// Importa primero la fachada: expone React en window y evalúa el motor
// vendorizado antes de que cualquier escena lo use.
import './engine/api';
import App from './App';

const el = document.getElementById('root');
if (!el) throw new Error('No se encontró #root en index.html');

createRoot(el).render(<App />);
