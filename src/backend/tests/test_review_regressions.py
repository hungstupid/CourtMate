"""Review gaps from the November SRS audit, using real committed API fixtures."""

import pytest
from test_core_api import committed_api as committed_api
from test_core_api import create_court


@pytest.mark.parametrize("contact", ["", "Updated venue contact"])
def test_owned_court_optional_contact_edit_round_trip(committed_api, contact):
    client, actor = committed_api
    owner, outsider = actor("owner"), actor("owner")
    court_id = create_court(client, owner)
    path = f"/api/owner/courts/{court_id}"
    before = client.get(path, headers=owner).json()
    changed = {"contact": contact, "name": "Updated name"}
    assert (
        client.patch(path, headers=outsider, json={"name": "Forbidden"}).status_code
        == 403
    )
    saved = client.patch(path, headers=owner, json=changed)
    assert saved.status_code == 200, saved.text
    after = client.get(path, headers=owner).json()
    assert after["contact"] == contact and after["name"] == "Updated name"
    assert after["id"] == before["id"] and after["owner_id"] == before["owner_id"]
    assert after["version"] == before["version"] + 1
    assert client.patch(path, headers=owner, json={"contact": None}).status_code == 422
    assert (
        client.patch(path, headers=owner, json={"contact": "x" * 201}).status_code
        == 422
    )
