import { toast } from "react-hot-toast";

export const switchOrAddMetamaskNetwork = async ({
  blockExplorerUrls,
  chainId,
  chainName,
  nativeCurrency,
  rpcUrls,
  callback,
}: {
  chainId: string;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls: string[];
  callback?: () => void;
}) => {
  const ethereum = (window as any)?.ethereum;
  if (!ethereum) toast.error("Metamask is not installed");
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
    if (callback) callback();
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask.
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId,
              chainName,
              rpcUrls,
              nativeCurrency,
              blockExplorerUrls,
            },
          ],
        });
        if (callback) callback();
      } catch (addError) {
        toast.error("Failed to add network to MetaMask");
        console.log("Failed to add network to MetaMask", addError);
      }
    }
    toast.error("Failed to switch network in MetaMask");
    console.log("Failed to switch network in MetaMask", switchError);
  }
};

// export const switchOrAddPolygonNetwork = async (callback?: () => void) =>
//   switchOrAddMetamaskNetwork({
//     chainId: "0x89",
//     chainName: "Polygon Mainnet",
//     rpcUrls: ["https://polygon-rpc.com"],
//     nativeCurrency: {
//       name: "MATIC",
//       symbol: "MATIC",
//       decimals: 18,
//     },
//     blockExplorerUrls: ["https://polygonscan.com/"],
//     callback,
//   });

// export const switchOrAddGoerliNetwork = async (callback?: () => void) =>
//   switchOrAddMetamaskNetwork({
//     chainId: "0x5",
//     chainName: "Goerli Testnet",
//     rpcUrls: ["https://goerli.infura.io/v3/"],
//     nativeCurrency: {
//       name: "GoerliETH",
//       symbol: "gETH",
//       decimals: 18,
//     },
//     blockExplorerUrls: ["https://goerli.etherscan.io"],
//     callback,
//   });

// export const switchToNetwork: Record<
//   number,
//   (_callback?: () => void) => Promise<void> | undefined
// > = {
//   5: switchOrAddGoerliNetwork,
//   137: switchOrAddPolygonNetwork,
// };
