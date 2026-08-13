import { Card } from '../Card/Card';
import './StatCard.css';
export function StatCard({ label, value, help }: { label: string; value: string; help: string }) { return <Card className="ui-stat-card"><div className="ui-stat-card__label">{label}</div><div className="ui-stat-card__value">{value}</div><div className="ui-stat-card__help">{help}</div></Card>; }
