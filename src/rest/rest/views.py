from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import json, logging, os
from pymongo import MongoClient
from pymongo.errors import PyMongoError

logger = logging.getLogger(__name__)

mongo_uri = 'mongodb://' + os.environ["MONGO_HOST"] + ':' + os.environ["MONGO_PORT"]
db = MongoClient(mongo_uri)['test_db']


def serialize_todo(todo):
    todo['id'] = str(todo.pop('_id'))
    return todo


class TodoListView(APIView):

    def get(self, request):
        try:
            todos = [serialize_todo(todo) for todo in db.todos.find()]
        except PyMongoError:
            logger.exception("Failed to fetch todos from MongoDB")
            return Response(
                {"error": "Failed to fetch todos"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(todos, status=status.HTTP_200_OK)

    def post(self, request):
        description = request.data.get('description', '').strip()
        if not description:
            return Response(
                {"error": "description is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        todo = {"description": description}
        try:
            result = db.todos.insert_one(todo)
        except PyMongoError:
            logger.exception("Failed to save todo to MongoDB")
            return Response(
                {"error": "Failed to save todo"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        todo['_id'] = result.inserted_id
        return Response(serialize_todo(todo), status=status.HTTP_201_CREATED)

