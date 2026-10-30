import CheckInChat from "@/components/CheckInChat";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>CIS 591 Journal Assistant</h1>
        <p className={styles.subtitle}>
          Milestone 1 · local prototype. Nothing is saved: refreshing the page clears the
          check-in.
        </p>
      </header>
      <CheckInChat />
    </main>
  );
}
