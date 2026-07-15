import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeviceCreateModal } from './DeviceCreateModal';

vi.mock('../hooks/useLuoghi', () => ({
  useLuoghi: () => ({
    luoghi: [
      { id: 'home', name: 'Casa', device_count: 1, display_order: 0 },
      { id: 'office', name: 'Ufficio', device_count: 2, display_order: 1 },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

describe('DeviceCreateModal', () => {
  it('resetta i campi alla riapertura mantenendo initialLuogoId', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <DeviceCreateModal open initialLuogoId="home" onClose={onClose} />,
    );

    fireEvent.change(screen.getByPlaceholderText('rpi-casa-mia-01'), {
      target: { value: 'rpi-test-01' },
    });
    fireEvent.change(screen.getByPlaceholderText('Raspberry Casa Mia 01'), {
      target: { value: 'Device test' },
    });
    fireEvent.change(screen.getByPlaceholderText('rpi-casamia-01'), {
      target: { value: 'host-temp' },
    });

    expect(screen.getByPlaceholderText('rpi-casa-mia-01')).toHaveValue('rpi-test-01');
    expect(screen.getByPlaceholderText('Raspberry Casa Mia 01')).toHaveValue('Device test');

    rerender(<DeviceCreateModal open={false} initialLuogoId="home" onClose={onClose} />);
    rerender(<DeviceCreateModal open initialLuogoId="home" onClose={onClose} />);

    expect(screen.getByPlaceholderText('rpi-casa-mia-01')).toHaveValue('');
    expect(screen.getByPlaceholderText('Raspberry Casa Mia 01')).toHaveValue('');
    expect(screen.getByPlaceholderText('rpi-casamia-01')).toHaveValue('');
    expect(screen.getByLabelText(/Luogo/i)).toHaveValue('home');
  });
});
