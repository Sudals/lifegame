import { useEffect, useRef, useState } from 'react';

/** 한 글자씩 출력. 클릭 시 즉시 완성. 완료 후 ▼ 깜빡임. */
interface Props {
  text: string;
  speed?: number;
  onTyping?: (typing: boolean) => void;
  onDone?: () => void;
  showCursor?: boolean;
}

/** 텍스트가 바뀌면 처음부터 다시 출력 (key로 상태 초기화) */
export function Typewriter(props: Props) {
  return <TypewriterInner key={props.text} {...props} />;
}

function TypewriterInner({ text, speed = 26, onTyping, onDone, showCursor = true }: Props) {
  const [n, setN] = useState(0);
  const done = n >= text.length;
  const cb = useRef({ onTyping, onDone });
  cb.current = { onTyping, onDone };

  useEffect(() => {
    cb.current.onTyping?.(!done);
    if (done) {
      cb.current.onDone?.();
      return;
    }
    const ch = text[n];
    const delay = ch === '.' || ch === '!' || ch === '?' ? speed * 6 : ch === ',' ? speed * 3 : speed;
    const t = window.setTimeout(() => setN((v) => v + 1), delay);
    return () => window.clearTimeout(t);
  }, [n, done, text, speed]);

  return (
    <span className="typewriter" onClick={() => setN(text.length)}>
      {text.slice(0, n)}
      <span className="tw-rest">{text.slice(n)}</span>
      {done && showCursor && <span className="tw-cursor">▼</span>}
    </span>
  );
}
