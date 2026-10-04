export default function Footer() {
  return (
    <footer className="w-full max-w-md text-center mt-6 text-xs text-gray-500">
      <p className="font-semibold">
        Versão Beta
        <br />
        &copy; 2026 Igreja Portugal Para Cristo - Covilhã
        <br />
        Todos os direitos reservados.
      </p>

      <div className="mt-4 flex flex-col items-center gap-3">
        <p className="text-xs text-gray-500 leading-snug">
          Desenvolvido por <br />
          <strong className="text-gray-500 font-semibold">
            Hudson Peres &amp; MangoDev Digital Solutions
          </strong>
        </p>

        <a
          href="https://mangodev.tech/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex justify-center"
        >
          <img
            src="/mangodev.png"
            alt="MangoDev Digital Solutions Logo"
            className="max-w-10 h-auto drop-shadow"
          />
        </a>
      </div>
    </footer>
  );
}
