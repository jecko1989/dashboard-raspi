import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LuogoFormModal } from './LuogoFormModal';

describe('LuogoFormModal', () => {
  it('resetta i campi quando viene riaperto in creazione', () => {
    const onClose = vi.fn();
    const { rerender } = render(<LuogoFormModal open onClose={onClose} />);

    const idInput = screen.getByPlaceholderText('casa_mia') as HTMLInputElement;
    const nameInput = screen.getByPlaceholderText('Casa Mia') as HTMLInputElement;
    const orderInput = screen.getByLabelText(/Ordine di visualizzazione/i) as HTMLInputElement;

    fireEvent.change(idInput, { target: { value: 'luogo-test' } });
    fireEvent.change(nameInput, { target: { value: 'Nome temporaneo' } });
    fireEvent.change(orderInput, { target: { value: '7' } });

    expect(idInput.value).toBe('luogo-test');
    expect(nameInput.value).toBe('Nome temporaneo');
    expect(orderInput.value).toBe('7');

    rerender(<LuogoFormModal open={false} onClose={onClose} />);
    rerender(<LuogoFormModal open onClose={onClose} />);

    expect(screen.getByPlaceholderText('casa_mia')).toHaveValue('');
    expect(screen.getByPlaceholderText('Casa Mia')).toHaveValue('');
    expect(screen.getByLabelText(/Ordine di visualizzazione/i)).toHaveValue(0);
  });

  it('passa da modifica a creazione resettando i valori del luogo precedente', () => {
    const onClose = vi.fn();
    const luogo = {
      id: 'ufficio',
      name: 'Ufficio',
      device_count: 2,
      display_order: 5,
    };

    const { rerender } = render(<LuogoFormModal open luogo={luogo} onClose={onClose} />);

    expect(screen.getByPlaceholderText('Casa Mia')).toHaveValue('Ufficio');
    expect(screen.getByLabelText(/Ordine di visualizzazione/i)).toHaveValue(5);

    rerender(<LuogoFormModal open onClose={onClose} />);

    expect(screen.getByPlaceholderText('casa_mia')).toHaveValue('');
    expect(screen.getByPlaceholderText('Casa Mia')).toHaveValue('');
    expect(screen.getByLabelText(/Ordine di visualizzazione/i)).toHaveValue(0);
  });
});
