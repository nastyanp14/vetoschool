import { createRoot } from 'react-dom/client';
import '../index.css';
if(import.meta.env.DEV){
  void import('./ConferenceManagementPreview').then(({default:Preview})=>createRoot(document.getElementById('root')!).render(<Preview/>));
}
