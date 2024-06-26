import demosMemory from "./memory";

import sha512 from "../utils/sha512";

import libdemos from "@libdemos";

import { crypto_hash_sha512_BYTES } from "../utils/interfaces";

import type { LibDemos } from "@libdemos";

/**
 * @function
 * Returns the Merkle root of a tree.
 * If Uint8Array items' length is 64, even after serializer,
 * then we assume that it is a hash.
 *
 * @param tree: The tree.
 * @param serializer: Converts leaves into Uint8Array.
 *
 * @returns Promise<Uint8Array>
 */
const getMerkleRoot = async (
  tree: Uint8Array[],
  module?: LibDemos,
): Promise<Uint8Array> => {
  const treeLen = tree.length;
  if (treeLen === 0) {
    throw new Error("Cannot calculate Merkle root of tree with no leaves.");
  } else if (treeLen === 1) {
    return await sha512(tree[0]);
  }

  const wasmMemory =
    module?.wasmMemory ?? demosMemory.getMerkleRootMemory(treeLen);
  const demosModule =
    module ??
    (await libdemos({
      wasmMemory,
    }));

  const ptr1 = demosModule._malloc(treeLen * crypto_hash_sha512_BYTES);
  const leavesHashed = new Uint8Array(
    wasmMemory.buffer,
    ptr1,
    treeLen * crypto_hash_sha512_BYTES,
  );

  let i = 0;
  let hash: Uint8Array;
  for (let j = 0; j < treeLen; j++) {
    hash = await sha512(tree[i], demosModule);
    leavesHashed.set(hash, i * crypto_hash_sha512_BYTES);
    i++;
  }

  const ptr2 = demosModule._malloc(crypto_hash_sha512_BYTES);
  const rootWasm = new Uint8Array(
    wasmMemory.buffer,
    ptr2,
    crypto_hash_sha512_BYTES,
  );

  const result = demosModule._get_merkle_root(
    treeLen,
    leavesHashed.byteOffset,
    rootWasm.byteOffset,
  );

  demosModule._free(ptr1);

  switch (result) {
    case 0: {
      const root = Uint8Array.from(rootWasm);
      demosModule._free(ptr2);

      return root;
    }

    case -1: {
      demosModule._free(ptr2);

      throw new Error("Could not calculate hash.");
    }

    default: {
      demosModule._free(ptr2);

      throw new Error("Unexpected error occured.");
    }
  }
};

export default getMerkleRoot;
