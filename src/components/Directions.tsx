import { describeRoute, feet } from '../lib/directions';
import type { RouteResult } from '../lib/types';

interface Props {
  route: RouteResult;
}

// A description of the path, not turn-by-turn navigation: there is no GPS and
// nothing recalculates as you walk. See CONTEXT.md on scope.
export default function Directions({ route }: Props) {
  const steps = describeRoute(route.coords);

  return (
    <div className="panel directions">
      <h2>Directions</h2>
      <ol>
        {steps.map((s, i) => (
          <li key={i}>
            <span className="step-text">{s.instruction}</span>
            {s.metres > 0 && (
              <span className="step-dist">{Math.round(feet(s.metres))} ft</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
