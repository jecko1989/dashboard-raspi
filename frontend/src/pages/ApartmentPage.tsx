import { useParams } from 'react-router-dom';
import { useApartments } from '../hooks/useApartments';
import { useDevices } from '../hooks/useDevices';
import { ApartmentSection } from '../components/ApartmentSection';

// Pagina di un singolo appartamento.
export function ApartmentPage() {
  const { apartmentId } = useParams<{ apartmentId: string }>();
  const { apartments } = useApartments();
  const { devices, loading, error } = useDevices(apartmentId);

  const apartment = apartments.find((a) => a.id === apartmentId);

  if (loading) return <p className="text-gray-500">Caricamento…</p>;
  if (error) return <p className="text-red-600">Errore: {error}</p>;
  if (!apartment) return <p className="text-gray-500">Appartamento non trovato.</p>;

  return <ApartmentSection apartment={apartment} devices={devices} />;
}
