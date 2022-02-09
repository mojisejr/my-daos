const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @dev Deployment Processes
 * 1. deploy NFT
 * 2. getTheExpectedAddressForGovernor
 * 3. deploy Timelock with expected address of Governor
 * 4. deploy target contract that will be Governed by the Governor (transaferOwnership to timelock contract)
 * 5. deploy Governor Contract with votes token or nft
 */

/**
 * @dev Testing scenarios
 * 1. mock NFT holders
 *  1.1) 1 NFT for 1 Votes Power
 * 2. set votesPeriod to 5 mins for testing purpose.
 * 3. set votesDelay to  1 block long delay.
 * 4. set threshold to 2
 * 5. set quarum to 2 votes to be pass for queue the transaction
 */

let erc721Factory;
let erc721;
let governorFactory;
let governor;
let timelockFactory;
let timelock;
let boxFactory;
let box;
let acc1;
let acc2;
let timelockDelay = 2;
let dao;

async function getExpectedContractAddress(deployer) {
  const transactionCount = await deployer.getTransactionCount();
  const expectedContractAddress = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: transactionCount + 4,
  });

  return expectedContractAddress;
}

function getProposalState(num) {
  switch (num) {
    case "0":
      console.log("=> Proposal state is: [ PENDING ]");
      break;
    case "1":
      console.log("=> Proposal state is: [ ACTIVE ]");
      break;
    case "2":
      console.log("=> Proposal state is: [ CANCELED ]");
      break;
    case "3":
      console.log("=> Proposal state is: [ DEFETED ]");
      break;
    case "4":
      console.log("=> Proposal state is: [ SUCCEEDED ]");
      break;
    case "5":
      console.log("=> Proposal state is: [ QUEUED ]");
      break;
    case "6":
      console.log("=> Proposal state is: [ EXPIRED ]");
      break;
    case "7":
      console.log("=> Proposal state  is: [ EXECUTED ]");
      break;
    default:
      console.log("=> Proposal state is: [ NONE ]");
  }
}

describe("DAO for NFT to update the value in the box.", () => {
  before(async () => {
    erc721Factory = await ethers.getContractFactory("MyNftDAO");
    timelockFactory = await ethers.getContractFactory("Timelock");
    governorFactory = await ethers.getContractFactory("MyNFTGovernor");
    boxFactory = await ethers.getContractFactory("Box");
    let signers = await ethers.getSigners();
    acc1 = signers[0];
    acc2 = signers[1];
    console.log("1) getGovernorExpected Address");
    let governorExpectedAddress = await getExpectedContractAddress(acc1);
    console.log("2) Deploy NFT");
    erc721 = await erc721Factory.deploy();
    await erc721.deployed();
    console.log("3) Deploy Timelock with expected Gov address");
    timelock = await timelockFactory.deploy(
      governorExpectedAddress,
      timelockDelay
    );
    await timelock.deployed();
    console.log("4) Deploy Box contract");
    box = await boxFactory.deploy();
    await box.deployed();
    console.log("5) Transfer Box ownership to Timelock");
    await box.transferOwnership(timelock.address);
    console.log("6) Deploy Governance Contract");
    governor = await governorFactory.deploy(erc721.address, timelock.address);
    await governor.deployed();
    console.log("====> DAO deployment Successfully <=====");

    dao = {
      governorExpectedAddress,
      signer: acc1.address,
      nft: erc721.address,
      timelock: timelock.address,
      governor: governor.address,
      box: box.address,
    };
    console.log("DAO info: ", dao);
  });

  it("should be able to deploy and has the name of the MyNftDAO", async () => {
    const name = await erc721.name();
    expect(name.toString()).to.equal("MyNftDAO");
  });

  it("holder mint the tokens correctly", async () => {
    console.log("7) user Minted NFT");
    await erc721.safeMint(acc1.address);
    await erc721.safeMint(acc1.address);
    await erc721.safeMint(acc1.address);
    await erc721.safeMint(acc1.address);
    await erc721.safeMint(acc1.address);
    await erc721.safeMint(acc1.address);
    expect((await erc721.totalSupply()).toString()).to.equal("6");
  });
  
  it("Box contract initial value should be 42", async () => {
    const initValue = await box.getValue();
    console.log("=> [ Initial Value of Box contract is ]: ", initValue.toString());
    expect(initValue.toString()).to.equal("42");
  })

  it("should be able to create the proposal by using propose function", async () => {
    /**
     * @dev propose function parameters
     * function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description)
     * targets : array of addresses of target contract. in this case is BOX contract
     * values: array of values of ethers attached to particular target
     * calldatas: array of function signature
     * descriptions: proposal descriptions
     */
    console.log("8) Dev need to set new value to the Box so do it via DAOs");
    console.log(
      "9) Setup function data for setValue by encode signature with it data"
    );
    let newValue = 555;
    let thisBox = await ethers.getContractAt("Box", dao.box);
    let encodedFunction = thisBox.interface.encodeFunctionData("setValue", [
      newValue,
    ]);

    // let encodedFunction = box.interface.encodeWithSignature()
    console.log(
      "10) Create proposal via propose() function call on Gov contract. (Could be multisig here ?)"
    );
    const result = await governor[
      "propose(address[],uint256[],bytes[],string)"
    ](
      [dao.box],
      [0],
      [encodedFunction],
      "Proposal #1 => Votes for setting new value to 555 in the box contract"
    );

    const receipt = await result.wait();
    const proposalId = receipt.events[0].args.proposalId;
    console.log(" => Proposal created successfully");
    console.log(" ==> Proposal Id:", proposalId.toString());
    let proposalState = await governor.state(proposalId);
    console.log(" - After proposal created");
    getProposalState(proposalState.toString());

    console.log("11) Test: skip voting delay by 1 block");

    await hre.network.provider.send("evm_mine");
    proposalState = await governor.state(proposalId);
    console.log(" - After voting delay has passed");
    getProposalState(proposalState.toString());

    console.log("12) Test: Cast some vote");
    await governor.connect(acc1).castVote(proposalId.toString(), 1);
    proposalState = await governor.state(proposalId);
    console.log(" - After casted votes");
    getProposalState(proposalState.toString());

    console.log(
      "13) Test: skip voting period for 5 blocks. In order to pass through voting peroid."
    );
    for (i = 0; i <= 5; i++) {
      await hre.network.provider.send("evm_mine");
    }
    console.log(
      " - After Voting peroid has passed, and proposal has succeeded"
    );
    proposalState = await governor.state(proposalId);
    getProposalState(proposalState.toString());

    console.log("14) Test: Queue transaction by executor(timelock)");
    await governor["queue(uint256)"](proposalId);
    console.log(" - After queue transaction");
    proposalState = await governor.state(proposalId);
    getProposalState(proposalState.toString());

    console.log(
      "15) Test: Execute trasaction by executor(timelock), after delay has passed"
    );

    let now = await hre.waffle.provider
      .getBlock("latest")
      .then((block) => block.timestamp);
    await hre.network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [now + 11],
    });

    await governor["execute(uint256)"](proposalId);
    console.log(" - After transaction executed successfully");
    proposalState = await governor.state(proposalId);
    getProposalState(proposalState.toString());
  });

  it("Box contract value should set to new value [ 555 ] ", async () => {
    const boxValue = await box.getValue();
    console.log("16) new value of the Box Contract changed from 42 to be: ", boxValue.toString());
    expect(boxValue.toString()).to.equal("555");
  })
});
