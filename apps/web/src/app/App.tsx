import "./App.css";

interface AppProps {
  children?: React.ReactNode;
}

export default function App({ children }: AppProps) {
  return <div className="app-root">{children}</div>;
}
