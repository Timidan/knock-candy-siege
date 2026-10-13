// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

interface IERC6551Registry {
    function account(address implementation, bytes32 salt, uint256 chainId, address tokenContract, uint256 tokenId)
        external
        view
        returns (address);
}

contract Knock is ERC1155, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant CANDY = 1;
    uint256 public constant EGG = 2;
    uint256 public constant TOILET_PAPER = 3;
    uint256 public constant MUSTACHE = 4;
    uint256 public constant PUMPKIN = 5;
    uint256 public constant GHOST = 6;
    uint256 public constant WITCH = 7;
    uint256 public constant DAILY_CANDY = 5;
    uint256 public constant DAILY_EGGS = 3;
    uint256 public constant DAILY_KNOCKS = 3;
    uint256 public constant WITCH_KNOCKS = 4;
    uint256 public constant MARK_DURATION = 1 days;
    uint256 public constant CHOG_COUNT = 1969;
    uint256 public constant THEME_COUNT = 4;
    uint256 public constant BLOOD_MOON = 1;
    uint256 public constant CANDY_RAIN = 2;
    uint256 public constant COSTUME_NIGHT = 3;
    uint256 public constant THEME_MULTIPLIER = 2;
    uint256 public constant COSTUME_EXTRA_KNOCKS = 1;
    uint256 public constant ROUTE_STOPS = 3;
    uint8 public constant ROUTE_COMPLETE = 7;
    uint256 public constant ROUTE_BONUS_CANDY = 10;
    uint8 public constant CREW_COUNT = 4;
    uint256 public constant CREW_BONUS_CANDY = 3;
    uint256 public constant TREAT_POINTS = 1;
    uint256 public constant TRICK_POINTS = 2;
    uint256 public constant HAUNT_TREAT_PERCENT = 40;
    uint256 public constant HAUNT_BOUNCE_PERCENT = 20;
    uint256 public constant RAID_POINTS = 2;
    uint256 public constant CLEAN_POINTS = 1;
    uint256 public constant BOSS_HP_PER_CHOG = 2;
    uint256 public constant BOSS_MIN_HP = 10;
    uint256 public constant BOSS_MAX_HP = 60;
    uint256 public constant BOSS_BASE_LOOT = 5;
    uint256 public constant BOSS_LOOT_PER_DAMAGE = 2;
    uint256 public constant BOSS_MAX_LOOT = 25;
    uint256 public constant RAID_TREATS = 3;
    uint256 public constant CAUGHT_CANDY = 2;

    IERC721 public immutable chog = IERC721(0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763);
    IERC20 public immutable chogToken;
    uint256 public immutable cleanFee;
    IERC6551Registry public constant registry = IERC6551Registry(0x000000006551c19487814612e58FE06813775758);
    address public constant accountProxy = 0x55266d75D1a14E4572138116aF39863Ed6596E7F;

    enum Outcome {
        TREAT,
        BOUNCE,
        TRICK,
        CLEAN,
        RAID,
        CAUGHT
    }

    struct House {
        uint256 day;
        uint256 knocksUsed;
        uint256 bowlCandy;
        uint256 bowlChog;
        uint256 chogPerTreat;
        bool trap;
        uint256 costume;
        uint256 markItem;
        uint256 markBy;
        uint256 markUntil;
        uint256 revengeOn;
        bool revengeReady;
        uint256 treatsGiven;
        uint256 tricksLanded;
        uint256 timesTricked;
        uint256 routeDay;
        uint8 routeMask;
        uint256 raidsLanded;
        uint256 timesRaided;
    }

    struct Delegate {
        address key;
        uint64 expiry;
        address ownerAtGrant;
    }

    struct Visit {
        uint256 from;
        uint256 to;
        uint256 item;
        Outcome outcome;
        uint256 timestamp;
    }

    mapping(uint256 => House) private _houses;
    mapping(uint256 => Visit[10]) private _visits;
    mapping(uint256 => uint256) private _visitCount;
    Visit[50] private _street;
    uint256 private _streetCount;
    uint256 public cleaningPot;
    mapping(uint256 => Delegate) public delegates;
    mapping(uint256 => uint256) public activeChogs;
    mapping(uint256 => uint8) public crewOf;
    mapping(uint256 => uint256) public crewSince; // the day a Chog joined its crew
    mapping(uint256 => mapping(uint8 => uint256)) public crewPoints;
    mapping(uint256 => uint256) public bossDamage;
    mapping(uint256 => bool) private _bossDefeated;
    mapping(uint256 => mapping(uint256 => uint256)) public damageBy;
    mapping(uint256 => mapping(uint256 => bool)) public claimed;

    event Knocked(uint256 indexed from, uint256 indexed to, uint256 item, Outcome outcome);
    event Haunted(uint256 indexed from, uint256 indexed to);
    event Rationed(uint256 indexed id, uint256 day);
    event BowlStocked(uint256 indexed id, uint256 candy, uint256 chogAmount, uint256 chogPerTreat);
    event BowlEmptied(uint256 indexed id, uint256 candy, uint256 chogAmount);
    event TrapSet(uint256 indexed id);
    event CostumeWorn(uint256 indexed id, uint256 costume);
    event Crafted(uint256 indexed id, uint256 item, uint256 amount);
    event Cleaned(uint256 indexed helper, uint256 indexed target, bool paid);
    event PotWithdrawn(address indexed to, uint256 amount);
    event URIChanged(string value);
    event DelegateSet(uint256 indexed id, address indexed key, uint64 expiry);
    event RouteCompleted(uint256 indexed id, uint256 indexed day);
    event CrewJoined(uint256 indexed id, uint8 crew);
    event CrewBonus(uint256 indexed id, uint256 indexed day);
    event BossHit(uint256 indexed id, uint256 indexed day, uint256 damage);
    event BossDefeated(uint256 indexed day);
    event BossLooted(uint256 indexed id, uint256 indexed day, uint256 candy);

    constructor(IERC20 token, uint256 fee) ERC1155("") Ownable(msg.sender) {
        require(address(token) != address(0), "zero token");
        chogToken = token;
        cleanFee = fee;
    }

    modifier onlyChogOwner(uint256 id) {
        require(chog.ownerOf(id) == msg.sender, "not owner");
        _;
    }

    modifier onlyPlayer(uint256 id) {
        address holder = chog.ownerOf(id);
        Delegate storage delegate = delegates[id];
        require(
            msg.sender == holder
                || (msg.sender == delegate.key && block.timestamp < delegate.expiry && delegate.ownerAtGrant == holder),
            "not owner"
        );
        _;
    }

    function tba(uint256 id) public view returns (address) {
        return registry.account(accountProxy, bytes32(0), block.chainid, address(chog), id);
    }

    function setDelegate(uint256 id, address key, uint64 expiry) external nonReentrant onlyChogOwner(id) {
        delegates[id] = Delegate(key, expiry, chog.ownerOf(id));
        emit DelegateSet(id, key, expiry);
    }

    function joinCrew(uint256 id, uint8 crew) external nonReentrant onlyChogOwner(id) {
        require(crew >= 1 && crew <= CREW_COUNT, "invalid crew");
        require(crewOf[id] == 0, "already joined");
        crewOf[id] = crew;
        crewSince[id] = block.timestamp / 1 days;
        emit CrewJoined(id, crew);
    }

    function knock(uint256 from, uint256 to, uint256 item) external nonReentrant onlyPlayer(from) {
        require(chog.ownerOf(to) != chog.ownerOf(from), "own target");
        require(item >= EGG && item <= MUSTACHE, "invalid trick");
        House storage visitor = _houses[from];
        House storage target = _houses[to];
        _rollDay(from);

        _useVisitKnock(from, to);
        require(balanceOf(tba(from), item) != 0, "no item");

        Outcome outcome = Outcome.TRICK;
        if (target.bowlCandy != 0) {
            outcome = Outcome.TREAT;
        } else if (target.trap && !_wearing(from, GHOST)) {
            outcome = Outcome.BOUNCE;
            target.trap = false;
        } else if (target.day == 0) {
            uint256 roll = uint256(
                keccak256(
                    abi.encode(
                        blockhash(block.number - 1), block.timestamp, from, to, visitor.knocksUsed, visitor.revengeReady
                    )
                )
            ) % 100;
            if (roll < HAUNT_TREAT_PERCENT) outcome = Outcome.TREAT;
            else if (roll < HAUNT_TREAT_PERCENT + HAUNT_BOUNCE_PERCENT) outcome = Outcome.BOUNCE;
            emit Haunted(from, to);
        }

        if (outcome == Outcome.TREAT) {
            target.treatsGiven++;
            if (target.bowlCandy != 0) {
                target.bowlCandy--;
                uint256 payout = target.chogPerTreat;
                if (payout != 0 && target.bowlChog >= payout) {
                    target.bowlChog -= payout;
                    chogToken.safeTransfer(tba(from), payout);
                }
            }
            _mint(tba(from), CANDY, 1, "");
        } else if (outcome == Outcome.BOUNCE) {
            _mark(from, item, to);
            _burn(tba(from), item, 1);
        } else {
            visitor.tricksLanded++;
            target.timesTricked++;
            _mark(to, item, from);
            _burn(tba(from), item, 1);
        }
        if (outcome == Outcome.TREAT) _score(from, TREAT_POINTS);
        else if (outcome == Outcome.TRICK) _score(from, TRICK_POINTS);
        _progressRoute(from, to);
        _record(from, to, item, outcome);
        emit Knocked(from, to, item, outcome);
    }

    function raid(uint256 from, uint256 to) external nonReentrant onlyPlayer(from) {
        require(chog.ownerOf(to) != chog.ownerOf(from), "own target");
        House storage visitor = _houses[from];
        House storage target = _houses[to];
        require(target.bowlCandy != 0, "nothing to raid");
        _rollDay(from);
        _useKnock(from); // no free revenge raids: two players could trade them back and forth forever
        target.revengeOn = from;
        target.revengeReady = true;

        Outcome outcome;
        if (target.trap && !_wearing(from, GHOST)) {
            outcome = Outcome.CAUGHT;
            target.trap = false;
            uint256 candy = balanceOf(tba(from), CANDY);
            if (candy > CAUGHT_CANDY) candy = CAUGHT_CANDY;
            target.bowlCandy += candy;
            if (candy != 0) _burn(tba(from), CANDY, candy);
        } else {
            outcome = Outcome.RAID;
            uint256 candy = target.bowlCandy < RAID_TREATS ? target.bowlCandy : RAID_TREATS;
            uint256 payout = target.chogPerTreat > target.bowlChog / RAID_TREATS
                ? target.bowlChog
                : RAID_TREATS * target.chogPerTreat;
            target.bowlCandy -= candy;
            target.bowlChog -= payout;
            visitor.raidsLanded++;
            target.timesRaided++;
            _score(from, RAID_POINTS);
            if (payout != 0) chogToken.safeTransfer(tba(from), payout);
            _mint(tba(from), CANDY, candy, "");
        }
        _progressRoute(from, to);
        _record(from, to, 0, outcome);
        emit Knocked(from, to, 0, outcome);
    }

    function hitBoss(uint256 from, uint256 item) external nonReentrant onlyPlayer(from) {
        uint256 day = block.timestamp / 1 days;
        require(!_bossDefeated[day], "boss defeated");
        require(item >= EGG && item <= MUSTACHE, "invalid trick");
        _rollDay(from);
        _useKnock(from);
        uint256 damage = item - EGG + 1;
        bossDamage[day] += damage;
        damageBy[day][from] += damage;
        _score(from, damage);
        _burn(tba(from), item, 1);
        emit BossHit(from, day, damage);
        if (bossDamage[day] >= bossHp(day)) {
            _bossDefeated[day] = true;
            emit BossDefeated(day);
        }
    }

    function claimBoss(uint256 id, uint256 day) external nonReentrant onlyPlayer(id) {
        require(_bossDefeated[day], "boss alive");
        require(damageBy[day][id] != 0, "no damage");
        require(!claimed[day][id], "already claimed");
        claimed[day][id] = true;
        uint256 candy = BOSS_BASE_LOOT + BOSS_LOOT_PER_DAMAGE * damageBy[day][id];
        if (candy > BOSS_MAX_LOOT) candy = BOSS_MAX_LOOT;
        _mint(tba(id), CANDY, candy, "");
        emit BossLooted(id, day, candy);
    }

    function stockBowl(uint256 id, uint256 candy, uint256 chogAmount, uint256 chogPerTreat)
        external
        nonReentrant
        onlyChogOwner(id)
    {
        House storage house = _houses[id];
        house.bowlCandy += candy;
        house.bowlChog += chogAmount;
        house.chogPerTreat = chogPerTreat;
        if (candy != 0) _burn(tba(id), CANDY, candy);
        if (chogAmount != 0) chogToken.safeTransferFrom(msg.sender, address(this), chogAmount);
        emit BowlStocked(id, candy, chogAmount, chogPerTreat);
    }

    function emptyBowl(uint256 id) external nonReentrant onlyChogOwner(id) {
        House storage house = _houses[id];
        uint256 candy = house.bowlCandy;
        uint256 chogAmount = house.bowlChog;
        house.bowlCandy = 0;
        house.bowlChog = 0;
        house.chogPerTreat = 0;
        if (candy != 0) _mint(tba(id), CANDY, candy, "");
        if (chogAmount != 0) chogToken.safeTransfer(chog.ownerOf(id), chogAmount);
        emit BowlEmptied(id, candy, chogAmount);
    }

    function setTrap(uint256 id) external nonReentrant onlyPlayer(id) {
        require(!_houses[id].trap, "trap set");
        _houses[id].trap = true;
        _burn(tba(id), PUMPKIN, 1);
        emit TrapSet(id);
    }

    function wear(uint256 id, uint256 costume) external nonReentrant onlyPlayer(id) {
        require(costume == 0 || costume == GHOST || costume == WITCH, "invalid costume");
        if (costume != 0) require(balanceOf(tba(id), costume) != 0, "no costume");
        _houses[id].costume = costume;
        emit CostumeWorn(id, costume);
    }

    function craft(uint256 id, uint256 item, uint256 amount) external nonReentrant onlyPlayer(id) {
        require(item >= TOILET_PAPER && item <= WITCH, "invalid craft");
        require(amount != 0, "zero amount");
        uint256 price = item == TOILET_PAPER ? 2 : item == MUSTACHE ? 3 : item == PUMPKIN ? 5 : 15;
        _burn(tba(id), CANDY, price * amount);
        _mint(tba(id), item, amount, "");
        emit Crafted(id, item, amount);
    }

    function clean(uint256 helper, uint256 target) external nonReentrant onlyPlayer(helper) {
        House storage house = _houses[target];
        require(house.markUntil > block.timestamp, "no active mark");
        if (helper == target) {
            require(chog.ownerOf(helper) == msg.sender, "not owner");
            cleaningPot += cleanFee;
            house.markItem = 0;
            house.markBy = 0;
            house.markUntil = 0;
            if (cleanFee != 0) chogToken.safeTransferFrom(msg.sender, address(this), cleanFee);
            emit Cleaned(helper, target, true);
        } else {
            require(chog.ownerOf(target) != chog.ownerOf(helper), "own target");
            _rollDay(helper);
            _useKnock(helper);
            house.markItem = 0;
            house.markBy = 0;
            house.markUntil = 0;
            _score(helper, CLEAN_POINTS);
            _record(helper, target, 0, Outcome.CLEAN);
            emit Cleaned(helper, target, false);
        }
    }

    function setURI(string calldata value) external nonReentrant onlyOwner {
        _setURI(value);
        emit URIChanged(value);
    }

    function withdrawPot() external nonReentrant onlyOwner {
        uint256 amount = cleaningPot;
        cleaningPot = 0;
        chogToken.safeTransfer(msg.sender, amount);
        emit PotWithdrawn(msg.sender, amount);
    }

    // Transfers call the receiver (possibly a Chog's upgraded account), so they share the game's reentrancy lock.
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data)
        public
        override
        nonReentrant
    {
        super.safeTransferFrom(from, to, id, value, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) public override nonReentrant {
        super.safeBatchTransferFrom(from, to, ids, values, data);
    }

    function setApprovalForAll(address operator, bool approved) public override nonReentrant {
        super.setApprovalForAll(operator, approved);
    }

    function transferOwnership(address newOwner) public override nonReentrant onlyOwner {
        super.transferOwnership(newOwner);
    }

    function renounceOwnership() public override nonReentrant onlyOwner {
        super.renounceOwnership();
    }

    function nightTheme(uint256 day) public pure returns (uint256) {
        return day % THEME_COUNT;
    }

    function routeOf(uint256 id, uint256 day) public view returns (uint256[3] memory route) {
        address holder = chog.ownerOf(id);
        for (uint256 i; i < ROUTE_STOPS; i++) {
            bytes32 seed = keccak256(abi.encode(day, id, i));
            uint256 stop = uint256(seed) % CHOG_COUNT + 1;
            // Skip repeats and houses the same wallet owns (that includes `id`): you can't knock on your own Chogs.
            while (stop == route[0] || stop == route[1] || chog.ownerOf(stop) == holder) {
                seed = keccak256(abi.encode(seed));
                stop = uint256(seed) % CHOG_COUNT + 1;
            }
            route[i] = stop;
        }
    }

    function routeProgress(uint256 id) external view returns (uint8 mask, uint256 day) {
        House storage house = _houses[id];
        return (house.routeMask, house.routeDay);
    }

    function bossHouse(uint256 day) public pure returns (uint256) {
        return uint256(keccak256(abi.encode("boss", day))) % CHOG_COUNT + 1;
    }

    function bossHp(uint256 day) public view returns (uint256) {
        uint256 hp = day == 0 ? 0 : BOSS_HP_PER_CHOG * activeChogs[day - 1];
        if (hp < BOSS_MIN_HP) return BOSS_MIN_HP;
        return hp > BOSS_MAX_HP ? BOSS_MAX_HP : hp;
    }

    function bossState(uint256 day) external view returns (uint256 house, uint256 hp, uint256 damage, bool defeated) {
        return (bossHouse(day), bossHp(day), bossDamage[day], _bossDefeated[day]);
    }

    function houses(uint256 id) external view returns (House memory) {
        return _houses[id];
    }

    function visits(uint256 id) external view returns (Visit[] memory result) {
        uint256 count = _visitCount[id];
        uint256 length = count < 10 ? count : 10;
        result = new Visit[](length);
        for (uint256 i; i < length; i++) {
            result[i] = _visits[id][(count - 1 - i) % 10];
        }
    }

    function street() external view returns (Visit[] memory result) {
        uint256 length = _streetCount < 50 ? _streetCount : 50;
        result = new Visit[](length);
        for (uint256 i; i < length; i++) {
            result[i] = _street[(_streetCount - 1 - i) % 50];
        }
    }

    function _rollDay(uint256 id) private {
        House storage house = _houses[id];
        uint256 today = block.timestamp / 1 days;
        if (house.day == today) return;
        house.day = today;
        house.knocksUsed = 0;
        activeChogs[today]++;
        uint256 multiplier = nightTheme(today) == CANDY_RAIN ? THEME_MULTIPLIER : 1;
        uint256 candy = DAILY_CANDY * multiplier;
        if (today != 0 && crewSince[id] < today && _crewWon(crewOf[id], today - 1)) {
            candy += CREW_BONUS_CANDY;
            emit CrewBonus(id, today - 1);
        }
        _mint(tba(id), CANDY, candy, "");
        _mint(tba(id), EGG, DAILY_EGGS * multiplier, "");
        emit Rationed(id, today);
    }

    function _useVisitKnock(uint256 from, uint256 to) private {
        House storage visitor = _houses[from];
        if (visitor.revengeReady && visitor.revengeOn == to) visitor.revengeReady = false;
        else _useKnock(from);
    }

    function _useKnock(uint256 id) private {
        House storage house = _houses[id];
        uint256 limit = _wearing(id, WITCH) ? WITCH_KNOCKS : DAILY_KNOCKS;
        if (nightTheme(block.timestamp / 1 days) == COSTUME_NIGHT && (_wearing(id, GHOST) || _wearing(id, WITCH))) {
            limit += COSTUME_EXTRA_KNOCKS;
        }
        require(house.knocksUsed < limit, "daily limit");
        house.knocksUsed++;
    }

    function _wearing(uint256 id, uint256 costume) private view returns (bool) {
        return _houses[id].costume == costume && balanceOf(tba(id), costume) != 0;
    }

    function _score(uint256 id, uint256 points) private {
        uint8 crew = crewOf[id];
        if (crew == 0) return;
        uint256 day = block.timestamp / 1 days;
        if (nightTheme(day) == BLOOD_MOON) points *= THEME_MULTIPLIER;
        crewPoints[day][crew] += points;
    }

    function _crewWon(uint8 crew, uint256 day) private view returns (bool) {
        if (crew == 0) return false;
        uint256 points = crewPoints[day][crew];
        for (uint8 other = 1; other <= CREW_COUNT; other++) {
            if (other != crew && crewPoints[day][other] >= points) return false;
        }
        return true;
    }

    function _progressRoute(uint256 from, uint256 to) private {
        House storage house = _houses[from];
        uint256 day = block.timestamp / 1 days;
        if (house.routeDay != day) {
            house.routeDay = day;
            house.routeMask = 0;
        }
        if (house.routeMask == ROUTE_COMPLETE) return;
        uint256[3] memory route = routeOf(from, day);
        for (uint256 i; i < ROUTE_STOPS; i++) {
            if (route[i] == to) house.routeMask |= uint8(1 << i);
        }
        if (house.routeMask == ROUTE_COMPLETE) {
            _mint(tba(from), CANDY, ROUTE_BONUS_CANDY, "");
            emit RouteCompleted(from, day);
        }
    }

    function _mark(uint256 id, uint256 item, uint256 by) private {
        House storage house = _houses[id];
        house.markItem = item;
        house.markBy = by;
        house.markUntil = block.timestamp + MARK_DURATION;
        house.revengeOn = by;
        house.revengeReady = true;
    }

    function _record(uint256 from, uint256 to, uint256 item, Outcome outcome) private {
        Visit memory visit = Visit(from, to, item, outcome, block.timestamp);
        uint256 count = _visitCount[to]++;
        _visits[to][count % 10] = visit;
        _street[_streetCount++ % 50] = visit;
    }
}
