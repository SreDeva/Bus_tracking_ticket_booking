// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DriverAssignmentTracker {
    struct Assignment {
        string busId;
        string source;
        string destination;
        string driverId;
        uint256 timestamp;
    }

    Assignment[] public assignments;

    // Index mappings
    mapping(string => uint256[]) private byBus;
    mapping(string => uint256[]) private byDriver;
    mapping(bytes32 => uint256[]) private byBusDriver; 
    mapping(bytes32 => uint256) private byBusTime;
    mapping(bytes32 => uint256) private byDriverTime;

    event AssignmentRecorded(uint256 indexed id, string busId, string driverId, uint256 timestamp);

    // --- Record Assignment ---
    function recordAssignment(
        string memory busId,
        string memory source,
        string memory destination,
        string memory driverId,
        uint256 timestamp
    ) public {
        uint256 id = assignments.length;
        assignments.push(Assignment(busId, source, destination, driverId, timestamp));

        byBus[busId].push(id);
        byDriver[driverId].push(id);
        byBusDriver[keccak256(abi.encodePacked(busId, driverId))].push(id);
        byBusTime[keccak256(abi.encodePacked(busId, timestamp))] = id;
        byDriverTime[keccak256(abi.encodePacked(driverId, timestamp))] = id;

        emit AssignmentRecorded(id, busId, driverId, timestamp);
    }

    // --- Retrieval Queries ---

    // 1. Get drivers by BusId (descending by timestamp)
    function getDriversByBus(string memory busId) public view returns (Assignment[] memory) {
        uint256[] storage ids = byBus[busId];
        Assignment[] memory results = new Assignment[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            results[i] = assignments[ids[ids.length - 1 - i]]; // descending
        }
        return results;
    }

    // 2. Get buses by DriverId (descending by timestamp)
    function getBusesByDriver(string memory driverId) public view returns (Assignment[] memory) {
        uint256[] storage ids = byDriver[driverId];
        Assignment[] memory results = new Assignment[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            results[i] = assignments[ids[ids.length - 1 - i]]; // descending
        }
        return results;
    }

    // 3. Get assignments by Bus + Driver
    function getAssignmentsByBusDriver(string memory busId, string memory driverId) 
        public 
        view 
        returns (Assignment[] memory) 
    {
        uint256[] storage ids = byBusDriver[keccak256(abi.encodePacked(busId, driverId))];
        Assignment[] memory results = new Assignment[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            results[i] = assignments[ids[ids.length - 1 - i]]; // descending
        }
        return results;
    }

    // 4. Get driver by Bus + Time
    function getDriverByBusTime(string memory busId, uint256 timestamp) public view returns (Assignment memory) {
        uint256 id = byBusTime[keccak256(abi.encodePacked(busId, timestamp))];
        return assignments[id];
    }

    // 5. Get bus by Driver + Time
    function getBusByDriverTime(string memory driverId, uint256 timestamp) public view returns (Assignment memory) {
        uint256 id = byDriverTime[keccak256(abi.encodePacked(driverId, timestamp))];
        return assignments[id];
    }
}