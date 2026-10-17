// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Minimal ERC20 interface for USDC token interactions
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title MisthosEscrow
 * @notice Production-grade milestone escrow and verifiable oracle settlement for Arc Testnet.
 * Settled natively in USDC (6 decimals).
 */
contract MisthosEscrow {
    // Arc USDC contract address (Native system address on Arc)
    IERC20 public immutable usdcToken;
    address public immutable defaultOracle;
    address public owner;

    enum MilestoneStatus {
        PENDING,
        FUNDED,
        PARTIALLY_RELEASED,
        RELEASED,
        DISPUTED,
        CANCELLED
    }

    struct Milestone {
        uint256 amount;          // Total agreed USDC (base units: 10^6)
        uint256 paidAmount;      // Cumulative USDC paid out
        bytes32 criteriaHash;    // Keccak256 hash of the Symbolon acceptance criteria
        MilestoneStatus status;
    }

    struct EscrowAgreement {
        bytes32 escrowId;
        address client;
        address contractor;
        address oracle;
        uint256 totalAmount;     // Total agreed USDC across all milestones
        uint256 fundedAmount;    // Total USDC deposited by client
        uint256 releasedAmount;  // Total USDC paid out to contractor
        bool isCancelled;
        bool isDisputed;
        uint256 milestoneCount;
        uint256 createdAt;
    }

    struct AttestationPayload {
        bytes32 escrowId;
        uint256 milestoneId;
        bytes32 deliverableHash;
        bytes32 policyHash;
        uint8 decision; // 1 = APPROVED, 2 = REJECTED, 3 = ESCALATED
        uint256 authorizedAmount;
        uint256 nonce;
        uint256 expiry;
    }

    // Storage mappings
    mapping(bytes32 => EscrowAgreement) public escrows;
    mapping(bytes32 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => bool) public usedNonces; // Replay attack protection for oracle attestations

    // EIP-712 Domain Separator components
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "MilestoneAttestation(bytes32 escrowId,uint256 milestoneId,bytes32 deliverableHash,bytes32 policyHash,uint8 decision,uint256 authorizedAmount,uint256 nonce,uint256 expiry)"
    );

    // Events
    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed client,
        address indexed contractor,
        address oracle,
        uint256 totalAmount,
        uint256 milestoneCount
    );

    event EscrowFunded(
        bytes32 indexed escrowId,
        address indexed funder,
        uint256 amount,
        uint256 totalFunded
    );

    event MilestoneReleased(
        bytes32 indexed escrowId,
        uint256 indexed milestoneId,
        address indexed contractor,
        uint256 amountPaid,
        uint256 totalMilestonePaid,
        bytes32 deliverableHash,
        uint256 nonce
    );

    event EscrowDisputed(bytes32 indexed escrowId, address indexed disputer);
    event EscrowCancelled(bytes32 indexed escrowId, uint256 refundedAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Misthos: caller is not owner");
        _;
    }

    constructor(address _usdcToken, address _defaultOracle) {
        require(_usdcToken != address(0), "Misthos: zero usdc address");
        require(_defaultOracle != address(0), "Misthos: zero oracle address");
        usdcToken = IERC20(_usdcToken);
        defaultOracle = _defaultOracle;
        owner = msg.sender;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("MisthosEscrow")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Creates a new milestone escrow agreement
     */
    function createEscrow(
        bytes32 escrowId,
        address contractor,
        address oracle,
        uint256[] calldata milestoneAmounts,
        bytes32[] calldata criteriaHashes
    ) external returns (bool) {
        require(escrowId != bytes32(0), "Misthos: invalid escrow id");
        require(escrows[escrowId].createdAt == 0, "Misthos: escrow already exists");
        require(contractor != address(0), "Misthos: invalid contractor");
        require(contractor != msg.sender, "Misthos: client cannot be contractor");
        require(milestoneAmounts.length > 0, "Misthos: empty milestones");
        require(milestoneAmounts.length == criteriaHashes.length, "Misthos: length mismatch");

        address assignedOracle = oracle == address(0) ? defaultOracle : oracle;
        uint256 calculatedTotal = 0;

        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            require(milestoneAmounts[i] > 0, "Misthos: zero milestone amount");
            calculatedTotal += milestoneAmounts[i];

            milestones[escrowId][i] = Milestone({
                amount: milestoneAmounts[i],
                paidAmount: 0,
                criteriaHash: criteriaHashes[i],
                status: MilestoneStatus.PENDING
            });
        }

        escrows[escrowId] = EscrowAgreement({
            escrowId: escrowId,
            client: msg.sender,
            contractor: contractor,
            oracle: assignedOracle,
            totalAmount: calculatedTotal,
            fundedAmount: 0,
            releasedAmount: 0,
            isCancelled: false,
            isDisputed: false,
            milestoneCount: milestoneAmounts.length,
            createdAt: block.timestamp
        });

        emit EscrowCreated(
            escrowId,
            msg.sender,
            contractor,
            assignedOracle,
            calculatedTotal,
            milestoneAmounts.length
        );

        return true;
    }

    /**
     * @notice Funds an escrow agreement with testnet USDC.
     * USDC on Arc is exposed through a standard ERC-20 interface at the native
     * precompile address, so funding is a plain transferFrom. msg.value is not used.
     */
    function fundEscrow(bytes32 escrowId, uint256 amount) external returns (bool) {
        EscrowAgreement storage escrow = escrows[escrowId];
        require(escrow.createdAt > 0, "Misthos: escrow not found");
        require(!escrow.isCancelled, "Misthos: escrow is cancelled");
        require(!escrow.isDisputed, "Misthos: escrow is disputed");
        require(amount > 0, "Misthos: zero funding amount");
        require(escrow.fundedAmount + amount <= escrow.totalAmount, "Misthos: exceeds total agreement");

        // Pull USDC via ERC-20 transferFrom (client must approve first)
        bool success = usdcToken.transferFrom(msg.sender, address(this), amount);
        require(success, "Misthos: USDC transferFrom failed");

        escrow.fundedAmount += amount;

        // Update milestones to FUNDED status sequentially
        uint256 remainingFunded = escrow.fundedAmount;
        for (uint256 i = 0; i < escrow.milestoneCount; i++) {
            Milestone storage m = milestones[escrowId][i];
            if (m.status == MilestoneStatus.PENDING && remainingFunded >= m.amount) {
                m.status = MilestoneStatus.FUNDED;
            }
            if (remainingFunded >= m.amount) {
                remainingFunded -= m.amount;
            } else {
                remainingFunded = 0;
            }
        }

        emit EscrowFunded(escrowId, msg.sender, amount, escrow.fundedAmount);
        return true;
    }

    /**
     * @notice Releases milestone payment to contractor upon presentation of a cryptographically
     * verified EIP-712 attestation from the authorized Oracle.
     */
    function releaseMilestone(
        AttestationPayload calldata att,
        bytes calldata signature
    ) external returns (bool) {
        EscrowAgreement storage escrow = escrows[att.escrowId];
        require(escrow.createdAt > 0, "Misthos: escrow not found");
        require(!escrow.isCancelled, "Misthos: escrow cancelled");
        require(!escrow.isDisputed, "Misthos: escrow disputed");
        require(att.milestoneId < escrow.milestoneCount, "Misthos: invalid milestone id");
        require(block.timestamp <= att.expiry, "Misthos: attestation expired");
        require(!usedNonces[att.nonce], "Misthos: attestation nonce already used");
        require(att.decision == 1, "Misthos: attestation not approved"); // 1 = APPROVED
        require(att.authorizedAmount > 0, "Misthos: authorized amount must be > 0");

        Milestone storage milestone = milestones[att.escrowId][att.milestoneId];
        require(
            milestone.status == MilestoneStatus.FUNDED || milestone.status == MilestoneStatus.PARTIALLY_RELEASED,
            "Misthos: milestone not ready for release"
        );

        uint256 remainingMilestone = milestone.amount - milestone.paidAmount;
        require(att.authorizedAmount <= remainingMilestone, "Misthos: payout exceeds milestone cap");
        require(escrow.releasedAmount + att.authorizedAmount <= escrow.fundedAmount, "Misthos: insufficient escrow funds");

        // Verify EIP-712 Signature
        bytes32 structHash = keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH,
                att.escrowId,
                att.milestoneId,
                att.deliverableHash,
                att.policyHash,
                att.decision,
                att.authorizedAmount,
                att.nonce,
                att.expiry
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        address recoveredSigner = recoverSigner(digest, signature);
        require(recoveredSigner == escrow.oracle, "Misthos: invalid oracle signature");

        // Mark nonce as consumed to protect against replay
        usedNonces[att.nonce] = true;

        // State update
        milestone.paidAmount += att.authorizedAmount;
        escrow.releasedAmount += att.authorizedAmount;

        if (milestone.paidAmount >= milestone.amount) {
            milestone.status = MilestoneStatus.RELEASED;
        } else {
            milestone.status = MilestoneStatus.PARTIALLY_RELEASED;
        }

        // Payout to contractor via ERC-20 USDC
        bool success = usdcToken.transfer(escrow.contractor, att.authorizedAmount);
        require(success, "Misthos: USDC transfer to contractor failed");

        emit MilestoneReleased(
            att.escrowId,
            att.milestoneId,
            escrow.contractor,
            att.authorizedAmount,
            milestone.paidAmount,
            att.deliverableHash,
            att.nonce
        );

        return true;
    }

    /**
     * @notice Dispute an escrow agreement
     */
    function disputeEscrow(bytes32 escrowId) external {
        EscrowAgreement storage escrow = escrows[escrowId];
        require(escrow.createdAt > 0, "Misthos: escrow not found");
        require(msg.sender == escrow.client || msg.sender == escrow.contractor, "Misthos: not party to escrow");
        require(!escrow.isCancelled, "Misthos: already cancelled");
        require(!escrow.isDisputed, "Misthos: already disputed");

        escrow.isDisputed = true;
        emit EscrowDisputed(escrowId, msg.sender);
    }

    /**
     * @notice Cancel escrow and refund unreleased funds if agreed or expired
     */
    function cancelEscrow(bytes32 escrowId) external returns (bool) {
        EscrowAgreement storage escrow = escrows[escrowId];
        require(escrow.createdAt > 0, "Misthos: escrow not found");
        require(msg.sender == escrow.client, "Misthos: only client can cancel");
        require(!escrow.isCancelled, "Misthos: already cancelled");
        require(escrow.releasedAmount == 0, "Misthos: cannot cancel partially released escrow");

        escrow.isCancelled = true;
        uint256 refundable = escrow.fundedAmount;
        escrow.fundedAmount = 0;

        if (refundable > 0) {
            bool success = usdcToken.transfer(escrow.client, refundable);
            require(success, "Misthos: USDC refund transfer failed");
        }

        emit EscrowCancelled(escrowId, refundable);
        return true;
    }

    /**
     * @dev Recover signer from signature
     */
    function recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            return address(0);
        }

        return ecrecover(hash, v, r, s);
    }

}
