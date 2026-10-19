import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { RequireAuth } from '@/features/auth/guards/RequireAuth';
import { RequireRole } from '@/features/auth/guards/RequireRole';
import { useSessionStore } from '@/features/auth/model/session.store';
import { LoginPage } from '@/features/auth/ui/LoginPage';
import { renderWithProviders } from '@/test/renderWithProviders';

function TestApp() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/tickets" element={<div>ZONA TICKETS</div>} />
        <Route element={<RequireRole allow={['admin']} />}>
          <Route path="/admin" element={<div>ZONA ADMIN</div>} />
        </Route>
      </Route>
    </Routes>
  );
}

function loginAs(role: 'admin' | 'agent') {
  const id = role === 'admin' ? 'u1' : 'u2';
  useSessionStore.getState().setSession(`mock-token-${id}`, {
    userId: id,
    email: `${role}@demo.co`,
    displayName: null,
    role,
  });
}

describe('Guardas de ruta', () => {
  it('redirige a /login cuando no hay sesión', () => {
    renderWithProviders(<TestApp />, { route: '/tickets' });
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
  });

  it('bloquea /admin para un agente', () => {
    loginAs('agent');
    renderWithProviders(<TestApp />, { route: '/admin' });
    expect(screen.getByText('ZONA TICKETS')).toBeInTheDocument();
  });

  it('permite /admin para un admin', () => {
    loginAs('admin');
    renderWithProviders(<TestApp />, { route: '/admin' });
    expect(screen.getByText('ZONA ADMIN')).toBeInTheDocument();
  });
});

describe('Login', () => {
  it('inicia sesión y navega a /tickets con credenciales válidas', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestApp />, { route: '/login' });

    await user.type(screen.getByLabelText(/correo/i), 'admin@demo.co');
    await user.type(screen.getByLabelText(/contraseña/i), 'admin1234');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    await waitFor(() => expect(screen.getByText('ZONA TICKETS')).toBeInTheDocument());
  });

  it('muestra "Credenciales inválidas" en 401', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestApp />, { route: '/login' });

    await user.type(screen.getByLabelText(/correo/i), 'admin@demo.co');
    await user.type(screen.getByLabelText(/contraseña/i), 'incorrecta');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    await waitFor(() => expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument());
  });
});
