import { Router, Route, Switch } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { ImportWorkspace } from '@/components/import-workspace';
import NotFound from '@/pages/not-found';

function App() {
 return <Router base={import.meta.env.BASE_URL.replace(/\/$/,'')}><ErrorBoundary><Switch><Route path="/" component={ImportWorkspace}/><Route component={NotFound}/></Switch></ErrorBoundary></Router>;
}
export default App;
