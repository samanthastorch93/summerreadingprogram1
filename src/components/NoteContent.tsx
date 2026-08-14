interface Props {
  text: string;
  onSelectUser?: (userId: string) => void;
  allProfiles?: { id: string; username: string }[];
  className?: string;
}

export default function NoteContent({ text, onSelectUser, allProfiles, className }: Props) {
  const parts = text.split(/(@\w+)/g);
  return (
    <p className={className}>
      {parts.map((chunk, i) => {
        if (chunk.startsWith('@') && chunk.length > 1) {
          const username = chunk.slice(1);
          const profile = allProfiles?.find((p) => p.username === username);
          if (profile && onSelectUser) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => { onSelectUser(profile.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="font-semibold text-brand-blue hover:underline"
              >
                {chunk}
              </button>
            );
          }
          return <strong key={i} className="font-semibold text-brand-blue">{chunk}</strong>;
        }
        return <span key={i}>{chunk}</span>;
      })}
    </p>
  );
}
