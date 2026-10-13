// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {Knock} from "../src/Knock.sol";

interface IRegistryCreate {
    function createAccount(address, bytes32, uint256, address, uint256) external returns (address);
}

interface IAccountProxy {
    function initialize(address implementation) external;
    function execute(address to, uint256 value, bytes calldata data, uint8 operation) external returns (bytes memory);
}

contract KnockTest is Test {
    address constant CHOG = 0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763;
    address constant TOKEN = 0x350035555E10d9AfAF1566AaebfCeD5BA6C27777;
    address constant REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    address constant IMPLEMENTATION = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC;
    Knock game;
    uint256 a;
    uint256 b;
    uint256 c;
    uint256 d;
    address ownerA;
    address ownerB;
    address ownerC;
    address ownerD;

    function setUp() public {
        vm.createSelectFork("https://rpc.monad.xyz");
        // Keep v1 ration assertions independent of the live night's theme.
        vm.warp((block.timestamp / 1 days / 4 * 4) * 1 days);
        game = new Knock(IERC20(TOKEN), 10 ether);
        for (uint256 id = 1; id <= 1969 && d == 0; id++) {
            address holder = IERC721(CHOG).ownerOf(id);
            if (a == 0) {
                a = id;
                ownerA = holder;
            } else if (b == 0 && holder != ownerA) {
                b = id;
                ownerB = holder;
            } else if (c == 0 && holder != ownerA && holder != ownerB) {
                c = id;
                ownerC = holder;
            } else if (c != 0 && holder != ownerA && holder != ownerB && holder != ownerC) {
                d = id;
                ownerD = holder;
            }
        }
        assertTrue(d != 0, "need four owners");
    }

    function _knock(address holder, uint256 from, uint256 to) internal {
        vm.prank(holder);
        game.knock(from, to, 2);
    }

    function testTreat() public {
        vm.prank(ownerC);
        game.hitBoss(c, 2);
        _knock(ownerB, b, c);
        deal(TOKEN, ownerB, 20 ether);
        vm.startPrank(ownerB);
        IERC20(TOKEN).approve(address(game), 20 ether);
        game.stockBowl(b, 2, 20 ether, 3 ether);
        vm.stopPrank();
        _knock(ownerA, a, b);
        assertEq(game.balanceOf(game.tba(a), 1), 6);
        assertEq(IERC20(TOKEN).balanceOf(game.tba(a)), 3 ether);
        Knock.House memory house = game.houses(b);
        uint256 candy = house.bowlCandy;
        uint256 chogAmount = house.bowlChog;
        uint256 treatsGiven = house.treatsGiven;
        assertEq(candy, 1);
        assertEq(chogAmount, 17 ether);
        assertEq(treatsGiven, 1);
        vm.prank(ownerB);
        game.emptyBowl(b);
        assertEq(game.balanceOf(game.tba(b), 1), 4);
        assertEq(IERC20(TOKEN).balanceOf(ownerB), 17 ether);
    }

    function testTrickAndRevenge() public {
        _knock(ownerB, b, c);
        vm.warp(block.timestamp + 4 days);
        _knock(ownerA, a, b);
        assertEq(game.balanceOf(game.tba(a), 2), 2);
        Knock.House memory house = game.houses(b);
        uint256 markItem = house.markItem;
        uint256 markBy = house.markBy;
        uint256 revengeOn = house.revengeOn;
        bool ready = house.revengeReady;
        assertEq(markItem, 2);
        assertEq(markBy, a);
        assertEq(revengeOn, a);
        assertTrue(ready);
        _knock(ownerB, b, a);
        house = game.houses(b);
        uint256 used = house.knocksUsed;
        bool stillReady = house.revengeReady;
        assertEq(used, 0);
        assertFalse(stillReady);
    }

    function testBounceAndGhost() public {
        _knock(ownerB, b, c);
        vm.warp(block.timestamp + 1 days);
        _knock(ownerB, b, c);
        vm.prank(ownerB);
        game.craft(b, 5, 1);
        vm.prank(ownerB);
        game.setTrap(b);
        _knock(ownerA, a, b);
        Knock.House memory house = game.houses(a);
        bool trap = game.houses(b).trap;
        uint256 markItem = house.markItem;
        uint256 markBy = house.markBy;
        assertFalse(trap);
        assertEq(markItem, 2);
        assertEq(markBy, b);
        assertEq(game.balanceOf(game.tba(a), 2), 2);

        for (uint256 i; i < 3; i++) {
            vm.warp(block.timestamp + 1 days);
            _knock(ownerA, a, c);
        }
        vm.prank(ownerA);
        game.craft(a, 6, 1);
        vm.prank(ownerA);
        game.wear(a, 6);
        vm.prank(ownerB);
        game.craft(b, 5, 1);
        vm.prank(ownerB);
        game.setTrap(b);
        _knock(ownerA, a, b);
        house = game.houses(b);
        trap = house.trap;
        markItem = house.markItem;
        assertTrue(trap);
        assertEq(markItem, 2);
    }

    function testLimits() public {
        vm.prank(ownerB);
        game.hitBoss(b, 2);
        for (uint256 i; i < 3; i++) {
            _knock(ownerA, a, b);
        }
        vm.prank(ownerA);
        vm.expectRevert("daily limit");
        game.knock(a, b, 2);
        vm.warp(block.timestamp + 1 days);
        _knock(ownerA, a, b);
        assertEq(game.balanceOf(game.tba(a), 2), 2);
        vm.warp(block.timestamp + 1 days);
        _knock(ownerA, a, b);
        vm.prank(ownerA);
        game.craft(a, 7, 1);
        vm.prank(ownerA);
        game.wear(a, 7);
        vm.warp(block.timestamp + 1 days);
        for (uint256 i; i < 4; i++) {
            _knock(ownerA, a, b);
        }
        uint256 used = game.houses(a).knocksUsed;
        assertEq(used, 4);
        vm.prank(ownerB);
        vm.expectRevert("not owner");
        game.knock(a, c, 2);
    }

    function testTBAUndeployedThenDeployed() public {
        vm.prank(ownerB);
        game.hitBoss(b, 2);
        uint256 id;
        address holder;
        for (uint256 candidate = 1; candidate <= 1969; candidate++) {
            if (game.tba(candidate).code.length == 0 && IERC721(CHOG).ownerOf(candidate) != ownerB) {
                id = candidate;
                holder = IERC721(CHOG).ownerOf(candidate);
                break;
            }
        }
        assertTrue(id != 0, "need undeployed TBA");
        address account = game.tba(id);
        assertEq(account.code.length, 0);
        _knock(holder, id, b);
        assertEq(game.balanceOf(account, 1), 5);
        assertEq(game.balanceOf(account, 2), 2);
        address created =
            IRegistryCreate(REGISTRY).createAccount(game.accountProxy(), bytes32(0), block.chainid, CHOG, id);
        assertEq(created, account);
        assertGt(account.code.length, 0);
        IAccountProxy(account).initialize(IMPLEMENTATION);
        vm.warp(block.timestamp + 1 days);
        _knock(holder, id, b);
        assertEq(game.balanceOf(account, 1), 10);
        bytes memory transfer = abi.encodeCall(game.safeTransferFrom, (account, holder, 1, 1, ""));
        vm.prank(holder);
        IAccountProxy(account).execute(address(game), 0, transfer, 0);
        assertEq(game.balanceOf(account, 1), 9);
        assertEq(game.balanceOf(holder, 1), 1);
    }

    function testClean() public {
        vm.prank(ownerB);
        game.hitBoss(b, 2);
        _knock(ownerA, a, b);
        deal(TOKEN, ownerB, 10 ether);
        vm.startPrank(ownerB);
        IERC20(TOKEN).approve(address(game), 10 ether);
        game.clean(b, b);
        vm.stopPrank();
        assertEq(game.cleaningPot(), 10 ether);
        uint256 markItem = game.houses(b).markItem;
        assertEq(markItem, 0);
        game.withdrawPot();
        assertEq(game.cleaningPot(), 0);
        assertEq(IERC20(TOKEN).balanceOf(address(this)), 10 ether);
        _knock(ownerA, a, b);
        vm.prank(ownerC);
        game.clean(c, b);
        uint256 used = game.houses(c).knocksUsed;
        assertEq(used, 1);
        assertEq(game.houses(b).markItem, 0);
        assertEq(game.balanceOf(game.tba(c), 1), 5);
        Knock.Visit[] memory recent = game.visits(b);
        assertEq(uint256(recent[0].outcome), uint256(Knock.Outcome.CLEAN));

        _knock(ownerA, a, b);
        vm.prank(ownerC);
        IERC721(CHOG).transferFrom(ownerC, ownerB, c);
        vm.prank(ownerB);
        vm.expectRevert("own target");
        game.clean(c, b);
    }

    function testDelegates() public {
        _knock(ownerA, a, c);
        address key = makeAddr("delegate");
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.expectEmit(address(game));
        emit Knock.DelegateSet(a, key, expiry);
        vm.prank(ownerA);
        game.setDelegate(a, key, expiry);
        (address storedKey, uint64 storedExpiry, address grantOwner) = game.delegates(a);
        assertEq(storedKey, key);
        assertEq(storedExpiry, expiry);
        assertEq(grantOwner, ownerA);
        _knock(ownerB, b, a);
        deal(TOKEN, ownerB, 3 ether);
        vm.startPrank(ownerB);
        IERC20(TOKEN).approve(address(game), 3 ether);
        game.stockBowl(b, 1, 3 ether, 3 ether);
        vm.stopPrank();
        _knock(key, a, b);
        assertEq(IERC20(TOKEN).balanceOf(game.tba(a)), 3 ether);
        assertEq(IERC20(TOKEN).balanceOf(key), 0);
        vm.startPrank(key);
        vm.expectRevert("not owner");
        game.stockBowl(a, 1, 0, 0);
        vm.expectRevert("not owner");
        game.emptyBowl(a);
        vm.expectRevert("not owner");
        game.joinCrew(a, 1);
        vm.expectRevert("not owner");
        game.setDelegate(a, key, expiry);
        vm.expectRevert("not owner");
        game.clean(a, a);
        vm.stopPrank();
        vm.prank(ownerC);
        IERC721(CHOG).transferFrom(ownerC, ownerA, c);
        vm.prank(key);
        vm.expectRevert("own target");
        game.knock(a, c, 2);
        vm.warp(expiry);
        vm.prank(key);
        vm.expectRevert("not owner");
        game.knock(a, b, 2);
        vm.prank(ownerA);
        game.setDelegate(a, key, uint64(block.timestamp + 1 days));
        vm.prank(ownerA);
        IERC721(CHOG).transferFrom(ownerA, ownerC, a);
        vm.prank(key);
        vm.expectRevert("not owner");
        game.knock(a, b, 2);
        _knock(ownerC, a, b);
    }

    function testRoute() public {
        uint256 day = block.timestamp / 1 days;
        uint256[3] memory route = game.routeOf(a, day);
        for (uint256 i; i < 3; i++) {
            assertGe(route[i], 1);
            assertLe(route[i], 1969);
            assertTrue(route[i] != a);
            for (uint256 j; j < i; j++) assertTrue(route[i] != route[j]);
            if (IERC721(CHOG).ownerOf(route[i]) == ownerA) {
                vm.prank(ownerA);
                IERC721(CHOG).transferFrom(ownerA, ownerB, route[i]);
            }
            vm.prank(IERC721(CHOG).ownerOf(route[i]));
            game.hitBoss(route[i], 2);
            if (i == 2) {
                vm.expectEmit(address(game));
                emit Knock.RouteCompleted(a, day);
            }
            _knock(ownerA, a, route[i]);
        }
        (uint8 mask, uint256 routeDay) = game.routeProgress(a);
        assertEq(mask, 7);
        assertEq(routeDay, day);
        assertEq(game.balanceOf(game.tba(a), 1), 15);
        _knock(IERC721(CHOG).ownerOf(route[0]), route[0], a);
        vm.prank(ownerA);
        game.craft(a, 3, 1);
        vm.prank(ownerA);
        game.knock(a, route[0], 3);
        assertEq(game.balanceOf(game.tba(a), 1), 13);
        assertEq(game.houses(a).knocksUsed, 3);
        vm.warp(block.timestamp + 1 days);
        route = game.routeOf(a, day + 1);
        if (IERC721(CHOG).ownerOf(route[0]) == ownerA) {
            vm.prank(ownerA);
            IERC721(CHOG).transferFrom(ownerA, ownerB, route[0]);
        }
        _knock(ownerA, a, route[0]);
        (mask, routeDay) = game.routeProgress(a);
        assertEq(mask, 1);
        assertEq(routeDay, day + 1);
    }

    function testCrews() public {
        vm.prank(ownerC);
        game.hitBoss(c, 2);
        uint256 day = block.timestamp / 1 days;
        vm.expectEmit(address(game));
        emit Knock.CrewJoined(a, 1);
        vm.prank(ownerA);
        game.joinCrew(a, 1);
        vm.prank(ownerA);
        vm.expectRevert("already joined");
        game.joinCrew(a, 2);
        vm.prank(ownerB);
        game.joinCrew(b, 2);
        vm.prank(ownerC);
        game.joinCrew(c, 1);
        _knock(ownerB, b, c);
        vm.prank(ownerB);
        game.stockBowl(b, 4, 0, 0);
        _knock(ownerA, a, b);
        assertEq(game.crewPoints(day, 1), 1);
        vm.prank(ownerA);
        game.raid(a, b);
        assertEq(game.crewPoints(day, 1), 3);
        _knock(ownerA, a, b);
        assertEq(game.crewPoints(day, 1), 5);
        vm.startPrank(ownerC);
        game.clean(c, b);
        game.craft(c, 5, 1);
        game.setTrap(c);
        vm.stopPrank();
        assertEq(game.crewPoints(day, 1), 6);
        _knock(ownerB, b, c);
        assertEq(game.crewPoints(day, 2), 2);
        assertEq(game.activeChogs(day), 3);

        uint256 candy = game.balanceOf(game.tba(a), 1);
        vm.warp(block.timestamp + 1 days);
        vm.expectEmit(address(game));
        emit Knock.CrewBonus(a, day);
        vm.prank(ownerA);
        game.hitBoss(a, 2);
        assertEq(game.balanceOf(game.tba(a), 1), candy + 8);
        assertEq(game.crewPoints(day + 1, 1), 2);
        vm.prank(ownerB);
        game.hitBoss(b, 2);
        assertEq(game.crewPoints(day + 1, 2), 2);
        vm.startPrank(ownerD);
        game.joinCrew(d, 1); // joins yesterday's winners after the fact
        game.hitBoss(d, 2);
        vm.stopPrank();
        assertEq(game.balanceOf(game.tba(d), 1), 5); // ration only, no bonus
        vm.prank(ownerB);
        game.hitBoss(b, 2); // keep tonight a tie (4 to 4), so tomorrow tests the no-winner case
        assertEq(game.crewPoints(day + 1, 1), 4);
        assertEq(game.crewPoints(day + 1, 2), 4);
        candy = game.balanceOf(game.tba(a), 1);
        vm.warp(block.timestamp + 1 days);
        vm.prank(ownerA);
        game.hitBoss(a, 2);
        assertEq(game.balanceOf(game.tba(a), 1), candy + 10);
    }

    function testBoss() public {
        uint256 day = block.timestamp / 1 days;
        assertEq(game.bossHp(day), 10);
        assertEq(game.bossHouse(day), uint256(keccak256(abi.encode("boss", day))) % 1969 + 1);
        vm.expectEmit(address(game));
        emit Knock.BossHit(a, day, 1);
        vm.prank(ownerA);
        game.hitBoss(a, 2);
        (uint256 house, uint256 hp, uint256 damage, bool defeated) = game.bossState(day);
        assertEq(house, game.bossHouse(day));
        assertEq(hp, 10);
        assertEq(damage, 1);
        assertFalse(defeated);
        vm.startPrank(ownerA);
        game.craft(a, 4, 1);
        game.craft(a, 3, 1);
        game.hitBoss(a, 4);
        game.hitBoss(a, 3);
        vm.expectRevert("daily limit");
        game.hitBoss(a, 2);
        vm.stopPrank();
        assertEq(game.damageBy(day, a), 6);
        vm.startPrank(ownerB);
        game.hitBoss(b, 2);
        game.craft(b, 4, 1);
        vm.expectEmit(address(game));
        emit Knock.BossHit(b, day, 3);
        vm.expectEmit(address(game));
        emit Knock.BossDefeated(day);
        game.hitBoss(b, 4);
        vm.stopPrank();
        (,, damage, defeated) = game.bossState(day);
        assertEq(damage, hp);
        assertTrue(defeated);
        vm.prank(ownerC);
        vm.expectRevert("boss defeated");
        game.hitBoss(c, 2);
        vm.prank(ownerC);
        vm.expectRevert("no damage");
        game.claimBoss(c, day);
        vm.expectEmit(address(game));
        emit Knock.BossLooted(a, day, 17);
        vm.prank(ownerA);
        game.claimBoss(a, day);
        assertEq(game.balanceOf(game.tba(a), 1), 17);
        assertTrue(game.claimed(day, a));
        vm.prank(ownerA);
        vm.expectRevert("already claimed");
        game.claimBoss(a, day);
        vm.warp(block.timestamp + 2 days);
        assertEq(game.bossHp(day + 2), 10);
    }

    function testRaid() public {
        vm.startPrank(ownerA);
        game.hitBoss(a, 2);
        game.craft(a, 5, 1); // Spend the wake-up ration before the raid's day.
        vm.stopPrank();
        uint256 day = block.timestamp / 1 days;
        _knock(ownerB, b, c);
        vm.warp(block.timestamp + 1 days);
        _knock(ownerB, b, c);
        deal(TOKEN, ownerB, 20 ether);
        vm.startPrank(ownerB);
        IERC20(TOKEN).approve(address(game), 20 ether);
        game.stockBowl(b, 5, 20 ether, 3 ether);
        game.craft(b, 5, 1);
        vm.stopPrank();
        vm.prank(ownerA);
        game.joinCrew(a, 1);
        _knock(ownerB, b, a); // a now holds a revenge knock on b
        vm.expectEmit(address(game));
        emit Knock.Knocked(a, b, 0, Knock.Outcome.RAID);
        vm.prank(ownerA);
        game.raid(a, b);
        assertEq(uint256(Knock.Outcome.RAID), 4);
        assertEq(game.houses(a).knocksUsed, 1); // the raid didn't spend the free revenge knock
        assertTrue(game.houses(a).revengeReady);
        assertEq(game.balanceOf(game.tba(a), 1), 8);
        assertEq(IERC20(TOKEN).balanceOf(game.tba(a)), 9 ether);
        assertEq(game.houses(b).bowlCandy, 2);
        assertEq(game.houses(b).bowlChog, 11 ether);
        assertEq(game.houses(a).raidsLanded, 1);
        assertEq(game.houses(b).timesRaided, 1);
        assertEq(game.houses(b).revengeOn, a);
        assertTrue(game.houses(b).revengeReady);
        assertEq(game.crewPoints(day + 1, 1), 4);
        vm.prank(ownerB);
        game.setTrap(b);
        vm.expectEmit(address(game));
        emit Knock.Knocked(a, b, 0, Knock.Outcome.CAUGHT);
        vm.prank(ownerA);
        game.raid(a, b);
        assertEq(uint256(Knock.Outcome.CAUGHT), 5);
        assertEq(game.balanceOf(game.tba(a), 1), 6);
        assertEq(game.houses(b).bowlCandy, 4);
        assertEq(game.houses(b).bowlChog, 11 ether);
        assertFalse(game.houses(b).trap);
        assertEq(game.houses(a).raidsLanded, 1);
        assertEq(game.houses(b).timesRaided, 1);
        assertEq(game.crewPoints(day + 1, 1), 4);
        Knock.Visit[] memory recent = game.visits(b);
        assertEq(uint256(recent[0].outcome), 5);
        assertEq(uint256(recent[1].outcome), 4);
        vm.prank(ownerA);
        vm.expectRevert("nothing to raid");
        game.raid(a, c);
    }

    function testThemedNights() public {
        vm.prank(ownerB);
        game.hitBoss(b, 2);
        uint256 day = block.timestamp / 1 days;
        _knock(ownerA, a, b);
        vm.warp((day + 2) * 1 days);
        assertEq(game.nightTheme(day + 2), 2);
        _knock(ownerA, a, b);
        assertEq(game.balanceOf(game.tba(a), 1), 15);
        assertEq(game.balanceOf(game.tba(a), 2), 7);
        vm.prank(ownerA);
        game.craft(a, 6, 1);
        vm.prank(ownerA);
        game.wear(a, 6);
        vm.warp((day + 3) * 1 days);
        assertEq(game.nightTheme(day + 3), 3);
        for (uint256 i; i < 4; i++) _knock(ownerA, a, b);
        assertEq(game.houses(a).knocksUsed, 4);
        vm.prank(ownerA);
        vm.expectRevert("daily limit");
        game.knock(a, b, 2);
        vm.warp((day + 7) * 1 days);
        address account = game.tba(a);
        vm.prank(account);
        game.safeTransferFrom(account, ownerA, 6, 1, "");
        for (uint256 i; i < 3; i++) _knock(ownerA, a, b);
        vm.prank(ownerA);
        vm.expectRevert("daily limit");
        game.knock(a, b, 2);
    }

    function testHauntedHouses() public {
        assertEq(game.HAUNT_TREAT_PERCENT(), 40);
        assertEq(game.HAUNT_BOUNCE_PERCENT(), 20);
        vm.prank(ownerA);
        game.joinCrew(a, 1);
        vm.prank(ownerC);
        game.joinCrew(c, 1);
        uint256 seen;
        for (uint256 i; i < 64; i++) {
            vm.warp((20_000 + 4 * i) * 1 days); // Quiet nights, with no previous-day crew bonus.
            vm.roll(1_000 + i);
            vm.setBlockhash(block.number - 1, bytes32(i + 1));
            uint256 from = i % 2 == 0 ? a : c;
            uint256 to = i % 4 < 2 ? b : d;
            address account = game.tba(from);
            uint256 candy = game.balanceOf(account, 1);
            uint256 eggs = game.balanceOf(account, 2);
            uint256 chogBalance = IERC20(TOKEN).balanceOf(account);
            uint256 treats = game.houses(to).treatsGiven;
            Knock.House memory visitor = game.houses(from);
            Knock.Outcome expected;
            {
                bool revenge = visitor.revengeReady && visitor.revengeOn == to;
                uint256 roll = uint256(keccak256(abi.encode(
                    blockhash(block.number - 1), block.timestamp, from, to,
                    revenge ? 0 : 1, visitor.revengeReady && !revenge
                ))) % 100;
                expected = roll < 40 ? Knock.Outcome.TREAT : roll < 60 ? Knock.Outcome.BOUNCE : Knock.Outcome.TRICK;
            }
            vm.expectEmit(address(game));
            emit Knock.Haunted(from, to);
            vm.expectEmit(address(game));
            emit Knock.Knocked(from, to, 2, expected);
            _knock(i % 2 == 0 ? ownerA : ownerC, from, to);
            assertEq(uint256(game.visits(to)[0].outcome), uint256(expected));
            seen |= 1 << uint256(expected);
            assertEq(game.houses(to).day, 0);
            assertEq(game.houses(to).bowlCandy, 0);
            assertFalse(game.houses(to).trap);
            assertEq(IERC20(TOKEN).balanceOf(account), chogBalance);
            assertEq(game.balanceOf(account, 1), candy + 5 + (expected == Knock.Outcome.TREAT ? 1 : 0));
            assertEq(game.balanceOf(account, 2), eggs + 3 - (expected == Knock.Outcome.TREAT ? 0 : 1));
            assertEq(game.houses(to).treatsGiven, treats + (expected == Knock.Outcome.TREAT ? 1 : 0));
            assertEq(game.crewPoints(block.timestamp / 1 days, 1),
                expected == Knock.Outcome.TREAT ? 1 : expected == Knock.Outcome.TRICK ? 2 : 0);
            if (expected != Knock.Outcome.TREAT) {
                Knock.House memory marked = game.houses(expected == Knock.Outcome.BOUNCE ? from : to);
                assertEq(marked.markItem, 2);
                assertEq(marked.markBy, expected == Knock.Outcome.BOUNCE ? to : from);
                assertEq(marked.markUntil, block.timestamp + 1 days);
            }
        }
        assertEq(seen, 7, "all haunted outcomes");

        _knock(ownerB, b, a);
        assertGt(game.houses(b).day, 0);
        vm.warp(block.timestamp + 4 days);
        _knock(ownerB, b, a);
        vm.startPrank(ownerB);
        game.stockBowl(b, 1, 0, 0);
        game.craft(b, 5, 1);
        game.setTrap(b);
        vm.stopPrank();
        vm.recordLogs();
        for (uint256 i; i < 3; i++) {
            vm.expectEmit(address(game));
            emit Knock.Knocked(a, b, 2, Knock.Outcome(i)); // Normal bowl treat, trap bounce, then plain trick.
            _knock(ownerA, a, b);
        }
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter == address(game)) {
                assertTrue(logs[i].topics[0] != keccak256("Haunted(uint256,uint256)"));
            }
        }
        assertEq(uint256(game.visits(b)[0].outcome), uint256(Knock.Outcome.TRICK));
    }
}
