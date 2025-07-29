import { Dashboard } from '../dashboard/components/Dashboard';
import { ThemeProvider } from 'styled-components';
import { theme } from '../styles/theme';

export default function DashboardPage() {
  return (
    <ThemeProvider theme={theme}>
      <Dashboard />
    </ThemeProvider>
  );
} 