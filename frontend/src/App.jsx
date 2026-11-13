import { useEffect, useState } from "react";
import {
  BrowserProvider,
  Contract,
  isAddress,
  keccak256,
  toUtf8Bytes,
} from "ethers";

const localNetwork = {
  chainId: "0x7a69",
  chainName: "Hardhat Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["http://127.0.0.1:8545"],
};

const amoyNetwork = {
  chainId: "0x13882",
  chainName: "Polygon Amoy Testnet",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: ["https://rpc-amoy.polygon.technology/"],
  blockExplorerUrls: ["https://amoy.polygonscan.com/"],
};

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";
}

function credentialHash(value) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Enter credential text first");
  }
  return keccak256(toUtf8Bytes(normalized));
}

function errorMessage(error) {
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.info?.error?.message ||
    error?.message ||
    "Transaction failed"
  ).replace(/^execution reverted: /, "");
}

export default function App() {
  const [deployment, setDeployment] = useState(null);
  const [deploymentError, setDeploymentError] = useState("");
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [activity, setActivity] = useState([]);
  const [issuerAddress, setIssuerAddress] = useState("");
  const [holderAddress, setHolderAddress] = useState("");
  const [didDocument, setDidDocument] = useState("Group 11 student DID document");
  const [didURI, setDidURI] = useState("ipfs://group-11-student-did-document");
  const [credentialText, setCredentialText] = useState(
    "Group 11 degree credential - Student 001"
  );

  useEffect(() => {
    fetch("/deployment.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Run the deployment command before starting the frontend");
        }
        return response.json();
      })
      .then(setDeployment)
      .catch((error) => setDeploymentError(error.message));
  }, []);

  useEffect(() => {
    if (!window.ethereum) {
      return undefined;
    }

    const synchronize = async () => {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      setAccount(accounts[0] || "");
      setChainId(Number(network.chainId));
    };

    synchronize().catch(() => {});
    window.ethereum.on("accountsChanged", synchronize);
    window.ethereum.on("chainChanged", synchronize);

    return () => {
      window.ethereum.removeListener("accountsChanged", synchronize);
      window.ethereum.removeListener("chainChanged", synchronize);
    };
  }, []);

  async function connectWallet() {
    if (!window.ethereum) {
      throw new Error("MetaMask is required for this demo");
    }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    setAccount(accounts[0] || "");
    setChainId(Number(network.chainId));
    return `Connected ${shortAddress(accounts[0])}`;
  }

  async function switchNetwork() {
    if (!deployment) {
      throw new Error("Deployment configuration is not available");
    }
    if (!window.ethereum) {
      throw new Error("MetaMask is required for this demo");
    }

    const configuration = deployment.chainId === 31337 ? localNetwork : amoyNetwork;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: configuration.chainId }],
      });
    } catch (error) {
      if (error.code !== 4902) {
        throw error;
      }
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [configuration],
      });
    }
    await connectWallet();
    return `Selected chain ${deployment.chainId}`;
  }

  async function getContext(requireSigner = true) {
    if (!deployment) {
      throw new Error(deploymentError || "Deployment configuration is loading");
    }
    if (!window.ethereum) {
      throw new Error("MetaMask is required for this demo");
    }

    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== deployment.chainId) {
      throw new Error(`Switch MetaMask to chain ${deployment.chainId}`);
    }
    const runner = requireSigner ? await provider.getSigner() : provider;
    return { provider, runner };
  }

  function getContract(name, runner) {
    const configuration = deployment?.contracts?.[name];
    if (!configuration?.address || !configuration?.abi) {
      throw new Error(`${name} is missing from deployment.json`);
    }
    return new Contract(configuration.address, configuration.abi, runner);
  }

  async function perform(label, action) {
    setBusy(true);
    setNotice(null);
    try {
      const detail = await action();
      setNotice({ type: "success", message: detail });
      setActivity((items) => [{ label, detail }, ...items].slice(0, 8));
    } catch (error) {
      setNotice({ type: "error", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function approveIssuer() {
    if (!isAddress(issuerAddress)) {
      throw new Error("Enter a valid university address");
    }
    const { runner } = await getContext();
    const accessControl = getContract("IssuerAccessControl", runner);
    await (await accessControl.addIssuer(issuerAddress)).wait();
    const approved = await accessControl.isIssuer(issuerAddress);
    return `University approved: ${approved}`;
  }

  async function registerDID() {
    if (!didDocument.trim() || !didURI.trim()) {
      throw new Error("Enter a DID document and URI");
    }
    const { runner } = await getContext();
    const didRegistry = getContract("DIDRegistry", runner);
    const hash = keccak256(toUtf8Bytes(didDocument.trim()));
    await (await didRegistry.registerDID(hash, didURI.trim())).wait();
    const active = await didRegistry.isActive(await runner.getAddress());
    return `Student DID active: ${active}`;
  }

  async function issueCredential() {
    if (!isAddress(holderAddress)) {
      throw new Error("Enter a valid student address");
    }
    const hash = credentialHash(credentialText);
    const { runner } = await getContext();
    const credentialStatus = getContract("CredentialStatus", runner);
    await (await credentialStatus.issueCredential(hash, holderAddress)).wait();
    const valid = await credentialStatus.isValid(hash);
    return `Credential issued and valid: ${valid}`;
  }

  async function verifyCredential(recordEvent) {
    const hash = credentialHash(credentialText);
    const { provider, runner } = await getContext(recordEvent);
    const credentialStatus = getContract("CredentialStatus", recordEvent ? runner : provider);

    if (recordEvent) {
      const auditLog = getContract("VerificationLog", provider);
      const receipt = await (await credentialStatus.verifyAndLog(hash)).wait();
      const event = receipt.logs
        .map((log) => {
          try {
            return auditLog.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((entry) => entry?.name === "CredentialVerified");
      if (!event) {
        throw new Error("CredentialVerified event was not found");
      }
      return `Verification recorded: ${event.args.valid ? "VALID" : "INVALID"}`;
    }

    const valid = await credentialStatus.isValid(hash);
    return `Credential status: ${valid ? "VALID" : "INVALID"}`;
  }

  async function revokeCredential() {
    const hash = credentialHash(credentialText);
    const { runner } = await getContext();
    const credentialStatus = getContract("CredentialStatus", runner);
    await (await credentialStatus.revokeCredential(hash)).wait();
    const valid = await credentialStatus.isValid(hash);
    return `Credential revoked. Valid now: ${valid}`;
  }

  const networkMatches = deployment && chainId === deployment.chainId;

  return (
    <main className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">CSE 540 · Group 11 · Interim Demo</p>
          <h1>Decentralized Degree Verification</h1>
          <p className="hero-copy">
            Follow a credential from university approval through issuance, verification and
            revocation.
          </p>
        </div>
        <div className="wallet-panel">
          <span>Wallet</span>
          <strong>{shortAddress(account)}</strong>
          <span>
            Chain {chainId ?? "-"} {networkMatches ? "· Ready" : "· Switch required"}
          </span>
          <div className="button-row">
            <button disabled={busy} onClick={() => perform("Wallet connected", connectWallet)}>
              Connect
            </button>
            <button
              className="secondary"
              disabled={busy || !deployment}
              onClick={() => perform("Network selected", switchNetwork)}
            >
              Switch network
            </button>
          </div>
        </div>
      </header>

      {deploymentError && <div className="notice error">{deploymentError}</div>}
      {notice && <div className={`notice ${notice.type}`}>{notice.message}</div>}

      <section className="deployment-strip">
        <div>
          <span>Deployment</span>
          <strong>{deployment?.network || "Not loaded"}</strong>
        </div>
        <div>
          <span>Expected chain</span>
          <strong>{deployment?.chainId || "-"}</strong>
        </div>
        <div>
          <span>Connected account</span>
          <strong>{shortAddress(account)}</strong>
        </div>
      </section>

      <section className="role-setup">
        <div>
          <p className="role">Before the workflow</p>
          <h2>Capture stakeholder wallets</h2>
          <p>
            Connect the university wallet and capture it, then connect the student wallet and
            capture it. Switch to the administrator wallet before step 1.
          </p>
        </div>
        <div className="role-address">
          <span>University</span>
          <strong>{shortAddress(issuerAddress)}</strong>
          <button
            className="secondary"
            disabled={!account}
            onClick={() => setIssuerAddress(account)}
          >
            Capture current wallet
          </button>
        </div>
        <div className="role-address">
          <span>Student</span>
          <strong>{shortAddress(holderAddress)}</strong>
          <button
            className="secondary"
            disabled={!account}
            onClick={() => setHolderAddress(account)}
          >
            Capture current wallet
          </button>
        </div>
      </section>

      <section className="workflow-grid">
        <article className="card">
          <div className="step-number">1</div>
          <p className="role">Administrator</p>
          <h2>Approve university</h2>
          <label>
            University wallet
            <input
              value={issuerAddress}
              onChange={(event) => setIssuerAddress(event.target.value)}
              placeholder="0x..."
            />
          </label>
          <button disabled={busy} onClick={() => perform("University approved", approveIssuer)}>
            Approve issuer
          </button>
        </article>

        <article className="card">
          <div className="step-number">2</div>
          <p className="role">Student</p>
          <h2>Register DID</h2>
          <label>
            DID document
            <input value={didDocument} onChange={(event) => setDidDocument(event.target.value)} />
          </label>
          <label>
            Document URI
            <input value={didURI} onChange={(event) => setDidURI(event.target.value)} />
          </label>
          <button disabled={busy} onClick={() => perform("Student DID registered", registerDID)}>
            Register DID
          </button>
        </article>

        <article className="card">
          <div className="step-number">3</div>
          <p className="role">University</p>
          <h2>Issue credential</h2>
          <label>
            Student wallet
            <input
              value={holderAddress}
              onChange={(event) => setHolderAddress(event.target.value)}
              placeholder="0x..."
            />
          </label>
          <label>
            Credential content
            <textarea
              value={credentialText}
              onChange={(event) => setCredentialText(event.target.value)}
              rows="3"
            />
          </label>
          <button disabled={busy} onClick={() => perform("Credential issued", issueCredential)}>
            Issue credential
          </button>
        </article>

        <article className="card">
          <div className="step-number">4</div>
          <p className="role">Employer</p>
          <h2>Verify credential</h2>
          <p className="card-copy">
            Check the same credential content before and after the university revokes it.
          </p>
          <button
            disabled={busy}
            onClick={() => perform("Credential checked", () => verifyCredential(false))}
          >
            Check validity
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => perform("Verification recorded", () => verifyCredential(true))}
          >
            Verify and log
          </button>
        </article>

        <article className="card">
          <div className="step-number">5</div>
          <p className="role">University</p>
          <h2>Revoke credential</h2>
          <p className="card-copy">
            Only the original issuer can set the credential's revocation bit.
          </p>
          <button disabled={busy} onClick={() => perform("Credential revoked", revokeCredential)}>
            Revoke credential
          </button>
        </article>

        <article className="card activity-card">
          <div className="step-number">6</div>
          <p className="role">Demo log</p>
          <h2>Session activity</h2>
          {activity.length === 0 ? (
            <p className="card-copy">Completed stakeholder actions appear here.</p>
          ) : (
            <ol className="activity-list">
              {activity.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>

      <footer>
        Credential content stays off-chain. Only hashes, role state and revocation status are
        recorded on-chain.
      </footer>
    </main>
  );
}
