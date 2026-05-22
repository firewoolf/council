import { ApiKeyForm } from '@/components/settings/ApiKeyForm';

export const metadata = {
  title: 'COUNCIL — 설정',
};

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tighter text-text sm:text-4xl">
          API 키 설정
        </h1>
        <p className="text-base leading-relaxed text-text-muted">
          COUNCIL은 당신의 API 키로 직접 AI를 호출합니다. 키는 이 기기에만
          저장되며, 우리 서버는 키를 보지 않습니다.
        </p>
      </div>

      <ApiKeyForm />
    </div>
  );
}
