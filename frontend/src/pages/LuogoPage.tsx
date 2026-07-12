import { useParams } from 'react-router-dom';
import { useLuoghi } from '../hooks/useLuoghi';
import { useDevices } from '../hooks/useDevices';
import { LuogoSection } from '../components/LuogoSection';

// Pagina di un singolo luogo.
export function LuogoPage() {
  const { luogoId } = useParams<{ luogoId: string }>();
  const { luoghi } = useLuoghi();
  const { devices, loading, error } = useDevices(luogoId);

  const luogo = luoghi.find((lg) => lg.id === luogoId);

  if (loading) return <p className="text-gray-500">Caricamento…</p>;
  if (error) return <p className="text-red-600">Errore: {error}</p>;
  if (!luogo) return <p className="text-gray-500">Luogo non trovato.</p>;

  return <LuogoSection luogo={luogo} devices={devices} />;
}
