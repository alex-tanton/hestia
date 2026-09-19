import type { ReactElement } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { routes } from './routes.tsx';

const router = createBrowserRouter(routes);

export function App(): ReactElement {
  return <RouterProvider router={router} />;
}
